import { Router } from "express";
import {
  FIRECRAWL_API_KEY,
  FIRECRAWL_ENABLED,
  MIMO_API_KEY,
  MIMO_BASE_URL,
  TAVILY_API_KEY,
  TAVILY_ENABLED,
} from "../config.js";

const router = Router();

router.get("/", (_req, res) => {
  res.json({
    ok: true,
    apiKeyConfigured: !!MIMO_API_KEY,
    providerBaseUrl: MIMO_BASE_URL,
    webTools: {
      tavilyConfigured: !!TAVILY_API_KEY,
      tavilyEnabled: TAVILY_ENABLED,
      firecrawlConfigured: !!FIRECRAWL_API_KEY,
      firecrawlEnabled: FIRECRAWL_ENABLED,
    },
  });
});

export default router;
