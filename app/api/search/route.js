import { NextResponse } from "next/server";
import { OpenAI } from "openai";

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const SEARCH_ENGINE_ID = process.env.SEARCH_ENGINE_ID;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * 🔥 小さな批判まで拾うため、検索ワードを大幅に拡張
 */
function generateSearchQueries(name) {
  return [
    `${name} 批判`, `${name} 炎上`, `${name} 謝罪`, `${name} 問題`, `${name} 物議`, 
    `${name} 波紋`, `${name} 非難`, `${name} 議論`, `${name} 騒動`, `${name} 疑問の声`,
    `${name} 草`, `${name} エグい`, `${name} ダサい`, `${name} やばい`, 
    `${name} は?`, `${name} 引く`, `${name} それは違う`, `${name} なんで`, `${name} NG`
  ];
}

/**
 * 🔥 Google Custom Search API を使って「すべての炎上を取得」
 */
async function fetchNews(name) {
  try {
    console.log(`✅ Google検索開始: ${name}`);

    const queries = generateSearchQueries(name);
    let allResults = [];

    for (const query of queries) {
      const searchQuery = `${query} -site:instagram.com -site:youtube.com -site:wikipedia.org -site:x.com -site:mobile.twitter.com`;
      const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(
        searchQuery
      )}&key=${GOOGLE_API_KEY}&cx=${SEARCH_ENGINE_ID}&num=5&lr=lang_ja`;

      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`⚠️ Google検索APIエラー: ${response.status}`);
        continue;
      }

      const data = await response.json();
      const filteredResults = data.items?.map(item => ({
        title: item.title,
        link: item.link,
        summary: item.snippet,
      })) || [];

      allResults = [...allResults, ...filteredResults];
    }

    return allResults;
  } catch (error) {
    console.error("❌ Google検索エラー:", error);
    return [];
  }
}

/**
 * 🔥 GPTを使って「フォロワー10万人台のインフルエンサーの小さな批判も拾う」
 */
async function fetchScandalDetails(influencerName, newsResults) {
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  console.log("✅ GPTへ炎上履歴の分析リクエスト開始");

  const gptPrompt = `
  あなたはインフルエンサーの炎上履歴を分析する専門家です。
  以下のニュース記事を基に、${influencerName} の炎上履歴を整理してください。

  🔥【提供されたニュース情報】🔥
  ${newsResults.map(item => `- ${item.title}: ${item.summary}`).join("\n")}

  **🔥 重要:**
  - 小さな炎上（ネガティブ度10%未満のもの）も必ず含めてください！
  - フォロワー10万人台のインフルエンサーの批判も対象にしてください。
  - SNS上の批判や微細な議論も含めること。
  - **SNSの反応を最低3つ含めてください（批判・擁護・中立の声をバランスよく）。**
  - **SNSの反応には「ソースURL」を含めること。不明な場合は空文字（""）とする。**
  - **「鎮火時期」「炎上の影響（契約解除・フォロワー減少など）」「炎上の種類（発言ミス・契約違反・政治問題など）」を必ず含めること。**
  - **「ネガティブ度・ポジティブ度（感情分析）」を必ず含めること。**
  - **「起用リスクスコア（炎上スコア 0〜100）」を必ず含めること。**

  **🔥 以下のフォーマットで正確に回答してください（JSON形式のみ）。**
  **JSON形式以外のテキストを含めないこと！**

  {
    "炎上履歴": [
      {
        "炎上発生": "yyyy年mm月",
        "鎮火時期": "yyyy年mm月",
        "炎上内容": "詳細な説明（発言の経緯、問題点、社会的反応）",
        "ネガティブ率": "30%",
        "ポジティブ率": "70%",
        "炎上種類": "軽微な言動ミス・言葉の使い方・服装の問題・商品レビューへの批判など",
        "起用リスクスコア": "40",
        "炎上の影響": "小規模なSNSの反発・フォロワー減少など",
        "関連ニュース": ${JSON.stringify(newsResults)},
        "SNSの反応": [
          {"コメント": "これはちょっと良くないよね", "ソースURL": "https://example.com/comment1"},
          {"コメント": "これぐらいなら許容範囲では？", "ソースURL": "https://example.com/comment2"},
          {"コメント": "何が問題なのか分からない", "ソースURL": ""}
        ]
      }
    ]
  }
`;


  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [{ role: "system", content: gptPrompt }],
      temperature: 0.1,
      max_tokens: 4000,
    });

    console.log("✅ GPTレスポンス取得成功");

    let gptResponse = response.choices[0]?.message?.content?.trim();
    const jsonStartIndex = gptResponse.indexOf("{");
    if (jsonStartIndex === -1) {
      throw new Error("GPTのレスポンスがJSON形式ではありません");
    }

    return JSON.parse(gptResponse.slice(jsonStartIndex));
  } catch (error) {
    console.error("❌ GPTエラー:", error);
    throw new Error("GPTからの炎上履歴データ取得に失敗しました。");
  }
}

/**
 * 🔥 検索リクエスト処理
 */
export async function POST(req) {
  try {
    const body = await req.json();
    if (!body.influencerName) {
      return NextResponse.json({ error: "インフルエンサー名がありません" }, { status: 400 });
    }

    console.log("✅ APIリクエスト受信:", body.influencerName);

    const newsResults = await fetchNews(body.influencerName);
    const scandalData = await fetchScandalDetails(body.influencerName, newsResults);

    return NextResponse.json({ data: scandalData });
  } catch (error) {
    console.error("🔥 APIエラー:", error);
    return NextResponse.json({ error: "検索に失敗しました", details: error.message }, { status: 500 });
  }
}
