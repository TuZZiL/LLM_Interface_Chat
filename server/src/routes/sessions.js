import { Router } from "express";
import { v4 as uuid } from "uuid";
import {
  getSessions,
  getSessionById,
  createSession,
  updateSession,
  deleteSession,
  getPromptById,
} from "../storage.js";
import { MODELS } from "../config.js";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const sessions = (await getSessions()).map(({ id, title, model, systemPromptId, createdAt, updatedAt }) => ({
      id,
      title,
      model,
      systemPromptId,
      createdAt,
      updatedAt,
    }));
    res.json(sessions);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { title = "New chat", model = "mimo-v2.5-pro", systemPromptId = null } = req.body;

    const session = await createSession({
      id: uuid(),
      title,
      model,
      systemPromptId,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    res.status(201).json(session);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const session = await getSessionById(req.params.id);
    if (!session) {
      return res.status(404).json({ error: { code: "SESSION_NOT_FOUND", message: "Session not found" } });
    }
    res.json(session);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const session = await getSessionById(req.params.id);
    if (!session) {
      return res.status(404).json({ error: { code: "SESSION_NOT_FOUND", message: "Session not found" } });
    }

    const updates = {};
    const { title, model, systemPromptId } = req.body;

    if (title !== undefined) {
      updates.title = String(title).trim() || session.title;
    }

    if (model !== undefined) {
      const exists = MODELS.some((m) => m.id === model);
      if (!exists) {
        return res.status(400).json({ error: { code: "INVALID_MODEL", message: `Unknown model: ${model}` } });
      }
      updates.model = model;
    }

    if (systemPromptId !== undefined) {
      if (systemPromptId !== null && !(await getPromptById(systemPromptId))) {
        return res.status(400).json({ error: { code: "PROMPT_NOT_FOUND", message: `Prompt ${systemPromptId} not found` } });
      }
      updates.systemPromptId = systemPromptId;
    }

    res.json(await updateSession(req.params.id, updates));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const removed = await deleteSession(req.params.id);
    if (!removed) {
      return res.status(404).json({ error: { code: "SESSION_NOT_FOUND", message: "Session not found" } });
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
