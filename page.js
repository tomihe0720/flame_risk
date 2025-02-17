"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

export default function Home() {
  const [influencer, setInfluencer] = useState("");
  const [result, setResult] = useState(null);
  const [recentSearches, setRecentSearches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState(null);
  const [initialAnimation, setInitialAnimation] = useState(true);

  useEffect(() => {
    const storedHistory = JSON.parse(localStorage.getItem("searchHistory")) || [];
    setRecentSearches(storedHistory);
  }, []);

  const handleSearch = async (name = influencer) => {
    setLoading(true);
    setProgress("🔥 炎上情報を収集中...");
    setError(null);
    setResult(null);
    setInitialAnimation(true);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ influencerName: name }),
      });

      if (!res.ok) {
        throw new Error(`HTTPエラー: ${res.status}`);
      }

      const data = await res.json();
      if (!data || !data.data || !data.data["炎上履歴"] || data.data["炎上履歴"].length === 0) {
        throw new Error("炎上データが取得できませんでした。");
      }

      setResult(data.data);
      setProgress("✅ データ取得完了！");
      setTimeout(() => setInitialAnimation(false), 2000);
    } catch (err) {
      console.error("🔥 検索エラー:", err);
      setError(err.message);
      setProgress("");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-8">
      <h1 className="text-4xl font-bold mb-4 tracking-wide">タレント・インフルエンサー炎上履歴検索</h1>

      {/* 🔍 検索ボックス & ボタン */}
      <div className="w-full max-w-2xl flex flex-col items-center">
        <input
          type="text"
          value={influencer}
          onChange={(e) => setInfluencer(e.target.value)}
          className="mt-4 p-3 text-black w-full rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="インフルエンサー名を入力"
        />

        <button
          className={`mt-4 px-8 py-3 text-white rounded-lg font-semibold shadow-md ${
            loading ? "bg-gray-500 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
          }`}
          onClick={() => handleSearch()}
          disabled={loading}
        >
          {loading ? "検索中..." : "検索"}
        </button>
      </div>

      {progress && <p className="mt-4 text-yellow-400 text-lg">{progress}</p>}
      {error && <p className="mt-4 text-red-500 text-lg">{error}</p>}

      {/* 🔥 最近の検索履歴（クリックで検索） */}
      <div className="mt-6 w-full max-w-5xl">
        <h2 className="text-2xl font-bold mb-4">🔍 最近の検索履歴</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {recentSearches.map((search, index) => (
            <motion.div
              key={index}
              className="p-4 bg-gray-800 rounded-lg shadow-md hover:scale-105 transition-transform cursor-pointer"
              whileHover={{ scale: 1.1 }}
              onClick={() => handleSearch(search.influencer_name)}
            >
              <h3 className="font-bold">{search.influencer_name}</h3>
              <p className="text-sm text-gray-300">🔥 炎上スコア: {search.risk_score}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {result && (
        <motion.div
          className="mt-6 w-full max-w-5xl bg-gray-800 p-6 rounded-lg shadow-lg"
          animate={initialAnimation ? { opacity: [0, 1], scale: [0.9, 1] } : {}}
          transition={{ duration: 1.5 }}
        >
          <h2 className="text-2xl font-bold mb-4">{influencer} の炎上履歴</h2>

          {result["炎上履歴"].map((entry, index) => (
            <div key={index} className="mt-4 p-5 bg-gray-700 rounded-lg shadow-md">
              <h3 className="text-lg font-bold">🔥 {entry["炎上発生"]} の炎上</h3>
              <p className="mt-2">{entry["炎上内容"]}</p>

              <h3 className="text-lg font-bold mt-4">⚠️ 起用リスクスコア</h3>
              <p className="text-red-500 text-2xl font-bold">{entry["起用リスクスコア"] || "データなし"} / 100</p>

              <h3 className="text-lg font-bold mt-4">📊 感情分析</h3>
              <div className="flex mt-2">
                <div className="h-6 bg-red-500 text-white text-center" style={{ width: entry["ネガティブ率"] }}>
                  ネガティブ {entry["ネガティブ率"]}
                </div>
                <div className="h-6 bg-green-500 text-white text-center" style={{ width: entry["ポジティブ率"] }}>
                  ポジティブ {entry["ポジティブ率"]}
                </div>
              </div>

              <h3 className="text-lg font-bold mt-4">📰 関連ニュース</h3>
              {entry["関連ニュース"] && entry["関連ニュース"].length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  {entry["関連ニュース"].map((news, i) => (
                    <div key={i} className="p-4 border border-gray-700 bg-gray-700 rounded-md">
                      <h4 className="font-bold">{news.title}</h4>
                      <p className="text-sm">{news.summary}</p>
                      <a href={news.link} className="text-blue-400 break-words" target="_blank" rel="noopener noreferrer">
                        記事を見る
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400">関連ニュースがありません。</p>
              )}

              <h3 className="text-lg font-bold mt-4">💬 SNSの反応</h3>
              {entry["SNSの反応"] && entry["SNSの反応"].length > 0 ? (
                <ul className="list-disc pl-4">
                  {entry["SNSの反応"].map((comment, i) => (
                    <li key={i} className="mt-1">
                      {comment["コメント"]}{" "}
                      {comment["ソースURL"] && comment["ソースURL"] !== "" && (
                        <a href={comment["ソースURL"]} target="_blank" rel="noopener noreferrer" className="text-blue-400">
                          [ソース]
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-400">SNSの反応データがありません。</p>
              )}

              <h3 className="text-lg font-bold mt-4">📌 炎上の種類</h3>
              <p className="text-gray-300">{entry["炎上種類"] || "分類情報なし"}</p>

              <h3 className="text-lg font-bold mt-4">💥 炎上の影響</h3>
              <p className="text-gray-300">{entry["炎上の影響"] || "影響情報なし"}</p>

              <h3 className="text-lg font-bold mt-4">⚠️ 鎮火時期</h3>
              <p className="text-gray-300">{entry["鎮火時期"] || "データなし"}</p>
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
