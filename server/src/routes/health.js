import { Router } from "express";
import {
  DEEPSEEK_API_KEY,
  DEEPSEEK_BASE_URL,
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
    providers: {
      mimo: {
        apiKeyConfigured: !!MIMO_API_KEY,
        baseUrl: MIMO_BASE_URL,
      },
      deepseek: {
        apiKeyConfigured: !!DEEPSEEK_API_KEY,
        baseUrl: DEEPSEEK_BASE_URL,
      },
    },
    webTools: {
      tavilyConfigured: !!TAVILY_API_KEY,
      tavilyEnabled: TAVILY_ENABLED,
      firecrawlConfigured: !!FIRECRAWL_API_KEY,
      firecrawlEnabled: FIRECRAWL_ENABLED,
    },
  });
});

export default router;
