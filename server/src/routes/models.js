import { Router } from "express";
import { MODELS } from "../config.js";

const router = Router();

router.get("/", (_req, res) => {
  res.json(MODELS);
});

export default router;
