import { TAVILY_API_KEY } from "./config.js";

const TAVILY_URL = "https://api.tavily.com/search";

export async function tavilySearch(query, options = {}) {
  if (!TAVILY_API_KEY) {
    throw new Error("TAVILY_API_KEY is not configured");
  }

  const body = {
    query,
    search_depth: "basic",
    max_results: 5,
    include_answer: false,
    include_raw_content: false,
    ...options,
  };

  const res = await fetch(TAVILY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TAVILY_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Tavily search failed (${res.status}): ${text}`);
  }

  const data = await res.json();

  return {
    results: (data.results || []).map((r) => ({
      title: r.title,
      url: r.url,
      content: r.content,
      score: r.score,
    })),
    responseTime: data.response_time,
  };
}
