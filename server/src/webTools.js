import {
  TAVILY_ENABLED,
  TAVILY_API_KEY,
  FIRECRAWL_ENABLED,
  FIRECRAWL_API_KEY,
} from "./config.js";
import { tavilySearch, tavilyExtract } from "./tavilyClient.js";
import { firecrawlSearch, firecrawlScrape } from "./firecrawlClient.js";

const SEARCH_DEFAULT_PROVIDER = "tavily";
const EXTRACT_DEFAULT_PROVIDER = "firecrawl";

export function getWebCapabilities() {
  const tavilyConfigured = !!TAVILY_API_KEY;
  const firecrawlConfigured = !!FIRECRAWL_API_KEY;
  const tavilyAvailable = TAVILY_ENABLED && tavilyConfigured;
  const firecrawlAvailable = FIRECRAWL_ENABLED && firecrawlConfigured;

  return {
    search: {
      defaultProvider: SEARCH_DEFAULT_PROVIDER,
      providers: {
        tavily: { configured: tavilyConfigured, enabled: tavilyAvailable },
        firecrawl: { configured: firecrawlConfigured, enabled: firecrawlAvailable },
      },
    },
    extract: {
      defaultProvider: EXTRACT_DEFAULT_PROVIDER,
      providers: {
        tavily: { configured: tavilyConfigured, enabled: tavilyAvailable },
        firecrawl: { configured: firecrawlConfigured, enabled: firecrawlAvailable },
      },
    },
  };
}

function isProviderAvailable(name) {
  if (name === "tavily") return TAVILY_ENABLED && !!TAVILY_API_KEY;
  if (name === "firecrawl") return FIRECRAWL_ENABLED && !!FIRECRAWL_API_KEY;
  return false;
}

function buildCacheKey(type, provider, identifier, options) {
  const opts = options || {};
  const serialized = Object.keys(opts)
    .sort()
    .map((k) => `${k}=${JSON.stringify(opts[k])}`)
    .join("&");
  return `${type}:${provider}:${identifier}:${serialized}`;
}

function searchOptionsForProvider(provider, options) {
  const { maxResults, max_results, ...rest } = options || {};
  const limit = maxResults ?? max_results;
  if (provider === "firecrawl" && limit !== undefined) {
    return { ...rest, limit };
  }
  if (provider === "tavily" && limit !== undefined) {
    return { ...rest, max_results: limit };
  }
  return rest;
}

export async function runWebSearch({ query, provider = "auto", options = {}, cache = null }) {
  if (provider !== "auto") {
    const opts = searchOptionsForProvider(provider, options);
    // Forced provider — no fallback
    if (!isProviderAvailable(provider)) {
      throw new Error(`Forced search provider "${provider}" is not available`);
    }
    const cacheKey = buildCacheKey("search", provider, query, opts);
    if (cache?.has(cacheKey)) return cache.get(cacheKey);

    let result;
    if (provider === "tavily") {
      result = await tavilySearch(query, opts);
    } else {
      result = await firecrawlSearch(query, opts);
    }
    cache?.set(cacheKey, result);
    return result;
  }

  // Auto routing: Tavily first, Firecrawl fallback
  const errors = [];

  if (isProviderAvailable("tavily")) {
    const opts = searchOptionsForProvider("tavily", options);
    const cacheKey = buildCacheKey("search", "tavily", query, opts);
    if (cache?.has(cacheKey)) return cache.get(cacheKey);
    try {
      const result = await tavilySearch(query, opts);
      cache?.set(cacheKey, result);
      return result;
    } catch (err) {
      errors.push(`tavily: ${err.message}`);
    }
  }

  if (isProviderAvailable("firecrawl")) {
    const opts = searchOptionsForProvider("firecrawl", options);
    const cacheKey = buildCacheKey("search", "firecrawl", query, opts);
    if (cache?.has(cacheKey)) return cache.get(cacheKey);
    try {
      const result = await firecrawlSearch(query, opts);
      cache?.set(cacheKey, result);
      return result;
    } catch (err) {
      errors.push(`firecrawl: ${err.message}`);
    }
  }

  throw new Error(`All search providers failed: ${errors.join("; ")}`);
}

export async function runWebExtract({ urls, provider = "auto", options = {}, cache = null }) {
  const urlList = Array.isArray(urls) ? urls : [urls];
  const opts = { ...options };

  if (provider !== "auto") {
    // Forced provider — no fallback
    if (!isProviderAvailable(provider)) {
      throw new Error(`Forced extract provider "${provider}" is not available`);
    }

    const uncachedUrls = [];
    const cachedResults = [];

    // Check cache for all URLs
    if (cache) {
      for (const url of urlList) {
        const cacheKey = buildCacheKey("extract", provider, url, opts);
        if (cache.has(cacheKey)) {
          cachedResults.push(cache.get(cacheKey));
        } else {
          uncachedUrls.push(url);
        }
      }
      if (uncachedUrls.length === 0) {
        return mergeExtractResults(provider, cachedResults);
      }
    } else {
      uncachedUrls.push(...urlList);
    }

    let result;
    if (provider === "tavily") {
      const fetched = uncachedUrls.length > 0
        ? await tavilyExtract(uncachedUrls, opts)
        : { provider: "tavily", results: [], failedResults: [] };
      result = {
        provider: "tavily",
        results: [...cachedResults, ...(fetched.results || [])],
        failedResults: fetched.failedResults || [],
      };
    } else {
      const settled = await Promise.allSettled(
        uncachedUrls.map((url) => firecrawlScrape(url, opts))
      );
      const fetched = [];
      const failed = [];
      for (let i = 0; i < settled.length; i++) {
        const s = settled[i];
        if (s.status === "fulfilled") {
          fetched.push(s.value);
        } else {
          failed.push({ url: uncachedUrls[i], error: s.reason?.message || String(s.reason) });
        }
      }
      result = {
        provider: "firecrawl",
        results: [...cachedResults, ...fetched],
        failedResults: failed,
      };
    }

    // Cache individual results
    if (cache) {
      for (const r of result.results || []) {
        const cacheKey = buildCacheKey("extract", provider, r.url, opts);
        cache.set(cacheKey, r);
      }
    }

    return result;
  }

  // Auto routing: Firecrawl first, Tavily fallback
  const errors = [];

  if (isProviderAvailable("firecrawl")) {
    const uncachedUrls = [];
    const cachedResults = [];
    if (cache) {
      for (const url of urlList) {
        const cacheKey = buildCacheKey("extract", "firecrawl", url, opts);
        if (cache.has(cacheKey)) {
          cachedResults.push(cache.get(cacheKey));
        } else {
          uncachedUrls.push(url);
        }
      }
      if (uncachedUrls.length === 0) {
        return { provider: "firecrawl", results: cachedResults, failedResults: [] };
      }
    } else {
      uncachedUrls.push(...urlList);
    }

    const settled = await Promise.allSettled(
      uncachedUrls.map((url) => firecrawlScrape(url, opts))
    );
    const fetched = [];
    const failed = [];
    for (let i = 0; i < settled.length; i++) {
      const s = settled[i];
      if (s.status === "fulfilled") {
        fetched.push(s.value);
        cache?.set(buildCacheKey("extract", "firecrawl", uncachedUrls[i], opts), s.value);
      } else {
        failed.push({ url: uncachedUrls[i], error: s.reason?.message || String(s.reason) });
      }
    }
    const allResults = [...cachedResults, ...fetched];
    if (allResults.length > 0) {
      return { provider: "firecrawl", results: allResults, failedResults: failed };
    }
    errors.push(`firecrawl: all ${failed.length} URL(s) failed`);
  }

  if (isProviderAvailable("tavily")) {
    const uncachedUrls = [];
    const cachedResults = [];
    if (cache) {
      for (const url of urlList) {
        const cacheKey = buildCacheKey("extract", "tavily", url, opts);
        if (cache.has(cacheKey)) {
          cachedResults.push(cache.get(cacheKey));
        } else {
          uncachedUrls.push(url);
        }
      }
      if (uncachedUrls.length === 0) {
        return { provider: "tavily", results: cachedResults, failedResults: [] };
      }
    } else {
      uncachedUrls.push(...urlList);
    }

    try {
      const result = await tavilyExtract(uncachedUrls, opts);
      if (cache) {
        for (const r of result.results || []) {
          cache.set(buildCacheKey("extract", "tavily", r.url, opts), r);
        }
      }
      return {
        provider: "tavily",
        results: [...cachedResults, ...(result.results || [])],
        failedResults: result.failedResults || [],
      };
    } catch (err) {
      errors.push(`tavily: ${err.message}`);
    }
  }

  throw new Error(`All extract providers failed: ${errors.join("; ")}`);
}

function mergeExtractResults(provider, cachedResults) {
  return {
    provider,
    results: cachedResults,
    failedResults: [],
  };
}
