import { Router } from "express";
import { v4 as uuid } from "uuid";
import {
  getPrompts,
  getPromptById,
  createPrompt,
  updatePrompt,
  deletePrompt,
} from "../storage.js";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    res.json(await getPrompts());
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { title, content, isDefault = false } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: { code: "VALIDATION", message: "title and content required" } });
    }

    const prompt = await createPrompt({
      id: uuid(),
      title,
      content,
      isDefault,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    res.status(201).json(prompt);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await getPromptById(id);
    if (!existing) {
      return res.status(404).json({ error: { code: "PROMPT_NOT_FOUND", message: "Prompt not found" } });
    }

    const updates = {};
    if (req.body.title !== undefined) updates.title = req.body.title;
    if (req.body.content !== undefined) updates.content = req.body.content;
    if (req.body.isDefault !== undefined) updates.isDefault = req.body.isDefault;

    const updated = await updatePrompt(id, updates);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const prompts = await getPrompts();
    if (prompts.length <= 1) {
      return res.status(400).json({ error: { code: "VALIDATION", message: "Cannot delete the only prompt" } });
    }
    const removed = await deletePrompt(id);
    if (!removed) {
      return res.status(404).json({ error: { code: "PROMPT_NOT_FOUND", message: "Prompt not found" } });
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
