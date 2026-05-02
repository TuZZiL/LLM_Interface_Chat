import { Router } from "express";
import {
  DEEPSEEK_API_KEY,
  DEEPSEEK_BASE_URL,
  MIMO_API_KEY,
  MIMO_BASE_URL,
} from "../config.js";
import { getWebCapabilities } from "../webTools.js";

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
    webTools: getWebCapabilities(),
  });
});

export default router;
