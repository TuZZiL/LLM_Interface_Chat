import { FIRECRAWL_API_KEY } from "./config.js";
import { fetchJsonWithTimeout } from "./httpClient.js";

const FIRECRAWL_BASE = "https://api.firecrawl.dev/v2";

const SEARCH_TIMEOUT = 20000;
const SCRAPE_TIMEOUT = 45000;

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
  };
}

export async function firecrawlSearch(query, options = {}) {
  if (!FIRECRAWL_API_KEY) {
    throw new Error("FIRECRAWL_API_KEY is not configured");
  }

  const body = {
    query,
    limit: 5,
    ...options,
  };

  const { res, data, text } = await fetchJsonWithTimeout(
    `${FIRECRAWL_BASE}/search`,
    { method: "POST", headers: authHeaders(), body: JSON.stringify(body) },
    SEARCH_TIMEOUT
  );

  if (!res.ok) {
    const detail = data?.error || text || res.statusText;
    throw new Error(`Firecrawl search failed (${res.status}): ${detail}`);
  }

  if (!data?.success) {
    throw new Error(data?.error || "Firecrawl search failed");
  }

  // Handle both response shapes:
  // Without scrapeOptions: { data: { web: [...] } }
  // With scrapeOptions: { data: [ { title, url, markdown, ... } ] }
  const web = Array.isArray(data.data) ? data.data : data.data?.web || [];

  return {
    provider: "firecrawl",
    results: web.map((r, i) => ({
      title: r.title || null,
      url: r.url,
      content: r.markdown || r.description || null,
      description: r.description || null,
      position: r.position ?? i + 1,
      markdown: r.markdown || null,
    })),
  };
}

export async function firecrawlScrape(url, options = {}) {
  if (!FIRECRAWL_API_KEY) {
    throw new Error("FIRECRAWL_API_KEY is not configured");
  }

  const body = {
    url,
    formats: ["markdown"],
    ...options,
  };

  const { res, data, text } = await fetchJsonWithTimeout(
    `${FIRECRAWL_BASE}/scrape`,
    { method: "POST", headers: authHeaders(), body: JSON.stringify(body) },
    SCRAPE_TIMEOUT
  );

  if (!res.ok) {
    const detail = data?.error || text || res.statusText;
    throw new Error(`Firecrawl scrape failed (${res.status}): ${detail}`);
  }

  if (!data?.success) {
    throw new Error(data?.error || "Firecrawl scrape failed");
  }

  const markdown = data.data?.markdown || "";
  const metaTitle = data.data?.metadata?.title || null;
  const metaDescription = data.data?.metadata?.description || null;
  const sourceURL = data.data?.metadata?.sourceURL || url;

  return {
    provider: "firecrawl",
    url,
    title: metaTitle,
    content: markdown,
    rawContent: markdown,
    markdown,
    images: [],
    favicon: null,
    metadata: {
      title: metaTitle,
      description: metaDescription,
      sourceURL,
    },
  };
}
