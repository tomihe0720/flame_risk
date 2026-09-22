import { NextResponse } from "next/server";
import { OpenAI } from "openai";

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const SEARCH_ENGINE_ID = process.env.SEARCH_ENGINE_ID;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// タイムアウトを 60 秒に設定
export const maxDuration = 60;

/**
 * 🔥 Google Custom Search API を使って「すべての炎上を取得」
 */
async function fetchNews(name) {
  try {
    console.log(`✅ Google検索開始: ${name}`);

    const searchQuery = `${name} 炎上 -site:instagram.com -site:youtube.com -site:wikipedia.org -site:x.com -site:mobile.twitter.com`;
    const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(searchQuery)}&key=${GOOGLE_API_KEY}&cx=${SEARCH_ENGINE_ID}&num=5&lr=lang_ja`;

    // タイムアウト制御（5秒以内に応答がない場合はキャンセル）
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) {
      console.error(`⚠️ Google検索APIエラー: ${response.status} - ${await response.text()}`);
      return [];
    }

    const data = await response.json();
    return data.items ? data.items.map(item => ({
      title: item.title,
      link: item.link,
      summary: item.snippet,
    })) : []; // 必ず `Array` を返す

  } catch (error) {
    console.error("❌ Google検索エラー:", error);
    return [];
  }
}

/**
 * 🔥 GPTを使って「炎上履歴の分析」
 */
async function fetchScandalDetails(influencerName, newsResults) {
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  console.log("✅ GPTへ炎上履歴の分析リクエスト開始");

  const gptPrompt = `
  あなたはインフルエンサーの炎上履歴を分析する専門家です。
  以下のニュース記事を基に、${influencerName} の炎上履歴を整理してください。

  🔥【提供されたニュース情報】🔥
  ${newsResults.map(item => `- ${item.title}: ${item.summary}`).join("\n")}

  **🔥 以下のフォーマットで正確に回答してください（JSON形式のみ）。**
  {
    "炎上履歴": [
      {
        "炎上発生": "yyyy年mm月",
        "鎮火時期": "yyyy年mm月",
        "炎上内容": "詳細な説明",
        "ネガティブ率": "30%",
        "ポジティブ率": "70%",
        "炎上種類": "軽微な言動ミス",
        "起用リスクスコア": "40",
        "炎上の影響": "SNSの反発・フォロワー減少など",
        "関連ニュース": ${JSON.stringify(newsResults)}
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
    console.log("🔍 GPTレスポンス:", gptResponse); // ← 追加
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
 * 🔥 API エンドポイント（Next.js App Router 形式）
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
