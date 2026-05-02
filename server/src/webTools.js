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
  return `${type}:${provider}:${identifier}:${JSON.stringify(options || {})}`;
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
        : { provider: "tavily", results: [] };
      result = { provider: "tavily", results: [...cachedResults, ...(fetched.results || [])] };
    } else {
      const results = [...cachedResults];
      for (const url of uncachedUrls) {
        const r = await firecrawlScrape(url, opts);
        results.push(r);
      }
      result = { provider: "firecrawl", results };
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
        return { provider: "firecrawl", results: cachedResults };
      }
    } else {
      uncachedUrls.push(...urlList);
    }

    try {
      const results = [...cachedResults];
      for (const url of uncachedUrls) {
        const r = await firecrawlScrape(url, opts);
        results.push(r);
        cache?.set(buildCacheKey("extract", "firecrawl", url, opts), r);
      }
      return { provider: "firecrawl", results };
    } catch (err) {
      errors.push(`firecrawl: ${err.message}`);
    }
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
        return { provider: "tavily", results: cachedResults };
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
      return { provider: "tavily", results: [...cachedResults, ...(result.results || [])] };
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
  };
}
