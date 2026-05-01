import { FIRECRAWL_API_KEY } from "./config.js";

const FIRECRAWL_BASE = "https://api.firecrawl.dev/v2";

export async function firecrawlScrape(url, options = {}) {
  if (!FIRECRAWL_API_KEY) {
    throw new Error("FIRECRAWL_API_KEY is not configured");
  }

  const body = {
    url,
    formats: ["markdown"],
    ...options,
  };

  const res = await fetch(`${FIRECRAWL_BASE}/scrape`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Firecrawl scrape failed (${res.status}): ${text}`);
  }

  const data = await res.json();

  if (!data.success) {
    throw new Error(data.error || "Firecrawl scrape failed");
  }

  return {
    markdown: data.data?.markdown || "",
    metadata: {
      title: data.data?.metadata?.title,
      description: data.data?.metadata?.description,
      sourceURL: data.data?.metadata?.sourceURL,
    },
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

  const res = await fetch(`${FIRECRAWL_BASE}/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Firecrawl search failed (${res.status}): ${text}`);
  }

  const data = await res.json();

  if (!data.success) {
    throw new Error(data.error || "Firecrawl search failed");
  }

  return {
    results: (data.data?.web || []).map((r) => ({
      title: r.title,
      url: r.url,
      content: r.description,
    })),
  };
}
