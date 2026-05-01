import "dotenv/config";

export const PORT = process.env.PORT || 3001;
export const MIMO_API_KEY = process.env.MIMO_API_KEY || "";
export const MIMO_BASE_URL = process.env.MIMO_BASE_URL || "https://api.xiaomimimo.com/v1";

export const MODELS = [
  {
    id: "mimo-v2.5-pro",
    label: "MiMo-V2.5-Pro",
    supportsText: true,
    supportsImages: false,
    defaultFor: "text",
  },
  {
    id: "mimo-v2.5",
    label: "MiMo-V2.5",
    supportsText: true,
    supportsImages: true,
    defaultFor: "image",
  },
];

export const IMAGE_MIME_ALLOW = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp"];
export const IMAGE_MAX_BYTES = 50 * 1024 * 1024; // 50 MB

export const DEFAULT_PARAMS = {
  temperature: 1,
  top_p: 0.95,
};

export const TAVILY_API_KEY = process.env.TAVILY_API_KEY || "";
const truthyValues = new Set(["true", "1", "yes", "on"]);
const falseyValues = new Set(["false", "0", "no", "off"]);

function readEnabledFlag(name, hasKey) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return hasKey;

  const normalized = raw.trim().toLowerCase();
  if (truthyValues.has(normalized)) return hasKey;
  if (falseyValues.has(normalized)) return false;
  return hasKey;
}

export const TAVILY_ENABLED = readEnabledFlag("TAVILY_ENABLED", !!TAVILY_API_KEY);

export const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY || "";
export const FIRECRAWL_ENABLED = readEnabledFlag("FIRECRAWL_ENABLED", !!FIRECRAWL_API_KEY);

export const WEB_SEARCH_TOOL = {
  type: "function",
  function: {
    name: "web_search",
    description:
      "Search the web for current information. Use when the user asks about recent events, facts you are unsure about, or needs up-to-date data.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "The search query to find relevant information" },
      },
      required: ["query"],
    },
  },
};

export const SCRAPE_URL_TOOL = {
  type: "function",
  function: {
    name: "scrape_url",
    description:
      "Extract the content of a web page as markdown. Use when the user shares a URL and wants you to read or analyze its content.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "The full URL to scrape" },
      },
      required: ["url"],
    },
  },
};

export function getEnabledTools() {
  const tools = [];
  if (TAVILY_ENABLED) tools.push(WEB_SEARCH_TOOL);
  if (FIRECRAWL_ENABLED) tools.push(SCRAPE_URL_TOOL);
  return tools;
}

export const ERROR_CODES = {
  MISSING_API_KEY: "MISSING_API_KEY",
  INVALID_MODEL: "INVALID_MODEL",
  MODEL_DOES_NOT_SUPPORT_IMAGES: "MODEL_DOES_NOT_SUPPORT_IMAGES",
  PROMPT_NOT_FOUND: "PROMPT_NOT_FOUND",
  SESSION_NOT_FOUND: "SESSION_NOT_FOUND",
  INVALID_IMAGE_TYPE: "INVALID_IMAGE_TYPE",
  IMAGE_TOO_LARGE: "IMAGE_TOO_LARGE",
  MIMO_REQUEST_FAILED: "MIMO_REQUEST_FAILED",
};
