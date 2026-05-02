# Web Tools Implementation Plan

## Goal

Add full local support for both web providers and their core tools:

- Tavily Search
- Tavily Extract
- Firecrawl Search
- Firecrawl Scrape

Keep the app simple. This is a single-user app, so avoid queues, persistent caches, admin dashboards, complex provider scoring, or speculative extensibility.

## Current State

- `server/src/tavilyClient.js` has `tavilySearch`.
- `server/src/firecrawlClient.js` has `firecrawlScrape` and unused `firecrawlSearch`.
- `server/src/config.js` registers:
  - `web_search` backed by Tavily
  - `scrape_url` backed by Firecrawl
- `server/src/routes/chat.js` uses web tools in two paths:
  - `buildWebContext()` prefetches web context automatically.
  - `executeToolCall()` runs model-requested tools.
- Current risks:
  - Firecrawl search exists as dead code.
  - Tavily Extract is missing.
  - Firecrawl Search is not available to model/backend routing.
  - URL extraction can happen twice in one request.
  - Provider fetch calls have no explicit timeout.
  - `/api/health` does not expose search/extract capabilities clearly.

## Product Decision

Expose two model-facing tools, not four vendor-specific tools.

Reason: the model should decide intent (`search` vs `extract`), while backend decides provider routing.

Model-facing tools:

- `web_search`
- `web_extract`

Provider capabilities behind those tools:

- `web_search` can use `tavily` or `firecrawl`.
- `web_extract` can use `tavily` or `firecrawl`.

Default provider policy:

- Search default: Tavily.
- Extract default: Firecrawl.
- If default provider is disabled or missing API key, fallback to the other provider.
- Optional tool arg `provider` can force `"tavily"` or `"firecrawl"`.

Do not add frontend provider selectors for this phase.

## Official Docs

- Tavily Search: `https://docs.tavily.com/documentation/api-reference/endpoint/search`
- Tavily Extract: `https://docs.tavily.com/documentation/api-reference/endpoint/extract`
- Firecrawl Search: `https://docs.firecrawl.dev/features/search`
- Firecrawl Scrape: `https://docs.firecrawl.dev/features/scrape`

Use these docs as source of truth if response shapes differ from existing code.

## Implementation Steps

### 1. Add Shared Fetch Timeout Helper

Create a small helper, likely:

- `server/src/httpClient.js`

Suggested API:

```js
export async function fetchJsonWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    return { res, data, text };
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
```

Keep it simple. No retry yet unless tests prove it is needed.

Suggested timeouts:

- Tavily Search: `15000`
- Tavily Extract: `30000`
- Firecrawl Search: `20000`
- Firecrawl Scrape: `45000`

### 2. Update Tavily Client

File:

- `server/src/tavilyClient.js`

Keep `tavilySearch(query, options = {})`.

Add:

```js
export async function tavilyExtract(urls, options = {}) {}
```

Expected request:

- URL: `https://api.tavily.com/extract`
- Method: `POST`
- Auth: `Authorization: Bearer ${TAVILY_API_KEY}`
- Body:
  - `urls`: string or string[]
  - `extract_depth`: default `"basic"`
  - `format`: default `"markdown"`
  - `timeout`: optional seconds, e.g. `30`
  - `include_images`: optional false
  - `include_favicon`: optional false

Normalize result to:

```js
{
  provider: "tavily",
  results: [
    {
      url,
      title,
      content,
      rawContent,
      images,
      favicon,
    }
  ],
  failedResults,
  responseTime,
  usage,
}
```

For Tavily Search, return normalized:

```js
{
  provider: "tavily",
  results: [
    {
      title,
      url,
      content,
      score,
      rawContent,
      favicon,
      images,
    }
  ],
  answer,
  responseTime,
  usage,
}
```

Preserve existing fields currently consumed by `chat.js`: `results[].title`, `results[].url`, `results[].content`, `results[].score`.

### 3. Update Firecrawl Client

File:

- `server/src/firecrawlClient.js`

Keep `firecrawlScrape(url, options = {})`.

Update or verify `firecrawlSearch(query, options = {})` against v2 docs.

Expected Firecrawl Search:

- URL: `https://api.firecrawl.dev/v2/search`
- Method: `POST`
- Auth: `Authorization: Bearer ${FIRECRAWL_API_KEY}`
- Body:
  - `query`
  - `limit`: default `5`
  - optional `scrapeOptions`

Normalize search response to:

```js
{
  provider: "firecrawl",
  results: [
    {
      title,
      url,
      content,
      description,
      position,
      markdown,
    }
  ]
}
```

Firecrawl docs may return either:

- `data.web`
- or direct `data` array depending endpoint/SDK examples.

Handle both shapes defensively:

```js
const web = Array.isArray(data.data) ? data.data : data.data?.web || [];
```

Normalize scrape response to:

```js
{
  provider: "firecrawl",
  url,
  markdown,
  content,
  metadata: {
    title,
    description,
    sourceURL,
  }
}
```

### 4. Add Provider Router

Create:

- `server/src/webTools.js`

Responsibilities:

- Choose provider.
- Execute provider client.
- Fallback from default provider to secondary provider.
- Normalize outputs for `chat.js`.
- Keep per-request cache support simple.

Suggested constants:

```js
const SEARCH_DEFAULT_PROVIDER = "tavily";
const EXTRACT_DEFAULT_PROVIDER = "firecrawl";
```

Suggested APIs:

```js
export function getWebCapabilities() {}

export async function runWebSearch({ query, provider = "auto", options = {}, cache = null }) {}

export async function runWebExtract({ urls, provider = "auto", options = {}, cache = null }) {}
```

Provider availability:

- Tavily available when `TAVILY_ENABLED && TAVILY_API_KEY`.
- Firecrawl available when `FIRECRAWL_ENABLED && FIRECRAWL_API_KEY`.

Routing:

- `runWebSearch({ provider: "auto" })`: Tavily first, Firecrawl fallback.
- `runWebExtract({ provider: "auto" })`: Firecrawl first, Tavily fallback.
- Forced provider should not fallback silently unless implementation chooses to include a clear warning. Prefer no fallback for forced provider.

Cache:

- Accept a `Map`.
- Use string keys:
  - `search:${provider}:${query}:${JSON.stringify(options)}`
  - `extract:${provider}:${url}:${JSON.stringify(options)}`
- For `urls` array, cache each URL separately where practical.

### 5. Update Tool Definitions

File:

- `server/src/config.js`

Replace old `SCRAPE_URL_TOOL` model registration with `WEB_EXTRACT_TOOL`.

Keep `web_search` name.

Suggested `web_search` schema:

```js
{
  type: "function",
  function: {
    name: "web_search",
    description:
      "Search the web for current or external information. Use when the user asks about recent events, up-to-date facts, unknown facts, or broad discovery.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
        provider: {
          type: "string",
          enum: ["auto", "tavily", "firecrawl"],
          description: "Optional provider override. Use auto unless the user asks for a specific provider."
        },
        maxResults: {
          type: "integer",
          minimum: 1,
          maximum: 10
        }
      },
      required: ["query"]
    }
  }
}
```

Suggested `web_extract` schema:

```js
{
  type: "function",
  function: {
    name: "web_extract",
    description:
      "Extract readable content from one or more specific URLs. Use when the user gives a URL or when search results need deeper page content.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string" },
        urls: {
          type: "array",
          items: { type: "string" }
        },
        provider: {
          type: "string",
          enum: ["auto", "tavily", "firecrawl"],
          description: "Optional provider override. Use auto unless the user asks for a specific provider."
        },
        format: {
          type: "string",
          enum: ["markdown", "text"]
        }
      }
    }
  }
}
```

In `getEnabledTools()`:

- Add `web_search` if either Tavily or Firecrawl search capability is enabled.
- Add `web_extract` if either Tavily or Firecrawl extract/scrape capability is enabled.

Do not register old `scrape_url` as a tool. Support it only in `executeToolCall()` temporarily for compatibility.

### 6. Update Chat Route

File:

- `server/src/routes/chat.js`

Imports:

- Remove direct `tavilySearch`.
- Remove direct `firecrawlScrape`.
- Import `runWebSearch`, `runWebExtract`.

Per request:

- Create one cache map near the start of each handler:

```js
const webCache = new Map();
```

Pass `webCache` into:

- `buildWebContext(textContent, notify, webCache)`
- `executeToolCall(toolCall, webCache)`

Update `buildWebContext`:

- If URLs exist: call `runWebExtract({ urls, provider: "auto", cache: webCache })`.
- If `shouldSearchWeb(textContent)`: call `runWebSearch({ query: textContent, provider: "auto", options: { maxResults: MAX_WEB_RESULTS }, cache: webCache })`.
- Preserve current context format enough that model sees:
  - fetched time
  - source title
  - URL
  - content excerpt

Update `executeToolCall`:

- `web_search`: call `runWebSearch`.
- `web_extract`: call `runWebExtract`.
- `scrape_url`: call `runWebExtract` as backward-compatible alias.

Sources:

- Search results should still populate `assistantMessage.searchResults`.
- Extract results should become sources with title/url/content excerpt.

### 7. Update Health Endpoint

File:

- `server/src/routes/health.js`

Import `getWebCapabilities()` from `webTools.js`.

Return explicit capabilities:

```js
webTools: {
  search: {
    defaultProvider: "tavily",
    providers: {
      tavily: { configured: true, enabled: true },
      firecrawl: { configured: true, enabled: true }
    }
  },
  extract: {
    defaultProvider: "firecrawl",
    providers: {
      tavily: { configured: true, enabled: true },
      firecrawl: { configured: true, enabled: true }
    }
  }
}
```

Keep old fields only if frontend currently depends on them. Search first with `rg "firecrawlEnabled|tavilyEnabled|webTools"` before removing.

### 8. Optional Frontend Touch

No required frontend changes.

If touching UI, keep it minimal:

- Health badge can continue showing active provider/model state.
- Do not add provider toggles yet.
- Avoid adding settings unless user explicitly asks.

### 9. Project Report Update

After implementation, update:

- `Project_Report.md`

Add short bullets:

- done
- verify
- context

No long implementation dump.

## Verification Checklist

Run:

```bash
node --check server/src/config.js
node --check server/src/tavilyClient.js
node --check server/src/firecrawlClient.js
node --check server/src/webTools.js
node --check server/src/routes/chat.js
node --check server/src/routes/health.js
npm run build --prefix client
```

Local HTTP smoke:

```powershell
npm start --prefix server
Invoke-RestMethod http://localhost:3001/api/health
```

Expected health:

- Tavily search capability shown.
- Tavily extract capability shown.
- Firecrawl search capability shown.
- Firecrawl extract/scrape capability shown.

Manual chat smoke cases:

1. Current search:
   - User: `What is the latest news about OpenAI today?`
   - Expected: search tool/status appears, answer cites sources.

2. URL extract:
   - User: `Прочитай https://example.com і коротко підсумуй.`
   - Expected: extract/scrape runs, answer uses page content.

3. Forced provider intent:
   - User: `Search with Firecrawl: current Nvidia news`
   - Expected: backend can route to Firecrawl if model passes provider, or at least Firecrawl search function works in direct smoke.

4. Deduplication:
   - User includes URL and model also calls `web_extract`.
   - Expected: same URL is not fetched twice in one request.

Direct function smoke can be done with a temporary one-liner dynamic import if API keys are configured.

## Non-Goals

- No persistent web cache.
- No background jobs.
- No provider ranking.
- No frontend provider switch UI.
- No crawl/map/batch scrape.
- No Firecrawl JSON extraction schema UI.
- No retry system unless timeout/network errors prove frequent.

## Acceptance Criteria

- Both Tavily and Firecrawl support search.
- Both Tavily and Firecrawl support URL content extraction.
- Model sees only `web_search` and `web_extract`.
- Backend can route provider automatically.
- Forced provider arg works.
- Health endpoint reports capabilities clearly.
- Duplicate same-URL extract within one chat request is avoided.
- Existing chat streaming behavior remains intact.
- Build/checks pass.
