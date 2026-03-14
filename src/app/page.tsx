"use client";

import { useState } from "react";

type HairstyleSuggestion = {
  name: string;
  reason: string;
};

export default function Page() {
  const [suggestions, setSuggestions] = useState<HairstyleSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    setLoading(true);

    const res = await fetch("/api/analyze-selfie", {
      method: "POST",
    });

    const data = await res.json();
    setSuggestions(data.suggestions || []);

    setLoading(false);
  };

  return (
    <main style={{ padding: "40px", fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: "32px", fontWeight: "bold" }}>HairMatch</h1>
      <p style={{ marginBottom: "20px" }}>
        AI hairstyle suggestions with local salon matching.
      </p>

      <button
        onClick={handleAnalyze}
        disabled={loading}
        style={{
          padding: "10px 16px",
          background: "black",
          color: "white",
          borderRadius: "6px",
        }}
      >
        {loading ? "Analyzing..." : "Analyze Selfie"}
      </button>

      {suggestions.length > 0 && (
        <div style={{ marginTop: "30px" }}>
          <h2>Suggested Hairstyles</h2>

          {suggestions.map((style) => (
            <div
              key={style.name}
              style={{
                border: "1px solid #ddd",
                padding: "16px",
                marginTop: "10px",
                borderRadius: "8px",
              }}
            >
              <h3>{style.name}</h3>
              <p>{style.reason}</p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
