import { Router } from "express";
import { MIMO_API_KEY, MIMO_BASE_URL } from "../config.js";

const router = Router();

router.get("/", (_req, res) => {
  res.json({
    ok: true,
    apiKeyConfigured: !!MIMO_API_KEY,
    providerBaseUrl: MIMO_BASE_URL,
  });
});

export default router;
