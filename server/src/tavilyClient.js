import { TAVILY_API_KEY } from "./config.js";
import { fetchJsonWithTimeout } from "./httpClient.js";

const TAVILY_SEARCH_URL = "https://api.tavily.com/search";
const TAVILY_EXTRACT_URL = "https://api.tavily.com/extract";

const SEARCH_TIMEOUT = 15000;
const EXTRACT_TIMEOUT = 30000;

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${TAVILY_API_KEY}`,
  };
}

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
    include_favicon: false,
    include_images: false,
    ...options,
  };

  const { res, data, text } = await fetchJsonWithTimeout(
    TAVILY_SEARCH_URL,
    { method: "POST", headers: authHeaders(), body: JSON.stringify(body) },
    SEARCH_TIMEOUT
  );

  if (!res.ok) {
    const detail = data?.detail?.error || data?.error || text || res.statusText;
    throw new Error(`Tavily search failed (${res.status}): ${detail}`);
  }

  return {
    provider: "tavily",
    results: (data.results || []).map((r) => ({
      title: r.title,
      url: r.url,
      content: r.content,
      score: r.score,
      rawContent: r.raw_content || null,
      favicon: r.favicon || null,
      images: r.images || [],
    })),
    answer: data.answer || null,
    responseTime: data.response_time,
    usage: data.usage || null,
  };
}

export async function tavilyExtract(urls, options = {}) {
  if (!TAVILY_API_KEY) {
    throw new Error("TAVILY_API_KEY is not configured");
  }

  const body = {
    urls,
    extract_depth: "basic",
    format: "markdown",
    include_images: false,
    include_favicon: false,
    ...options,
  };

  const { res, data, text } = await fetchJsonWithTimeout(
    TAVILY_EXTRACT_URL,
    { method: "POST", headers: authHeaders(), body: JSON.stringify(body) },
    EXTRACT_TIMEOUT
  );

  if (!res.ok) {
    const detail = data?.detail?.error || data?.error || text || res.statusText;
    throw new Error(`Tavily extract failed (${res.status}): ${detail}`);
  }

  return {
    provider: "tavily",
    results: (data.results || []).map((r) => ({
      url: r.url,
      title: r.title || null,
      content: r.raw_content || null,
      rawContent: r.raw_content || null,
      images: r.images || [],
      favicon: r.favicon || null,
    })),
    failedResults: data.failed_results || [],
    responseTime: data.response_time,
    usage: data.usage || null,
  };
}
