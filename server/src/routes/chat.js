import { Router } from "express";
import { v4 as uuid } from "uuid";
import { MODELS, ERROR_CODES } from "../config.js";
import { getSessionById, updateSession, getPromptById } from "../storage.js";
import { chatCompletion, chatCompletionStream, AppError } from "../mimoClient.js";

const router = Router();

// --- Shared helpers ---

function resolveModel(requestedModel, attachments) {
  const imageAttachments = attachments.filter((attachment) => attachment.dataUrl);
  let modelId = requestedModel || (imageAttachments.length > 0 ? "mimo-v2.5" : "mimo-v2.5-pro");
  let modelConfig = MODELS.find((m) => m.id === modelId);

  if (!modelConfig) {
    throw new AppError(ERROR_CODES.INVALID_MODEL, `Unknown model: ${modelId}`, 400);
  }

  if (imageAttachments.length > 0 && !modelConfig.supportsImages) {
    const imageModel = MODELS.find((m) => m.supportsImages);
    if (imageModel) {
      modelId = imageModel.id;
      modelConfig = imageModel;
    } else {
      throw new AppError(
        ERROR_CODES.MODEL_DOES_NOT_SUPPORT_IMAGES,
        `Model ${modelId} does not support images`,
        400
      );
    }
  }

  return { modelId, modelConfig };
}

async function resolveSystemPrompt(promptId) {
  if (!promptId) return "";
  const prompt = await getPromptById(promptId);
  if (!prompt) {
    throw new AppError(ERROR_CODES.PROMPT_NOT_FOUND, `Prompt ${promptId} not found`, 400);
  }
  return prompt.content;
}

function buildMimoMessages(systemContent, session, textContent, attachments) {
  const messages = [];

  if (systemContent) {
    messages.push({ role: "system", content: systemContent });
  }

  if (session) {
    for (const msg of session.messages) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  let userContent;
  const imageAttachments = attachments.filter((attachment) => attachment.dataUrl);
  if (imageAttachments.length > 0) {
    const parts = [];
    for (const att of imageAttachments) {
      parts.push({ type: "image_url", image_url: { url: att.dataUrl } });
    }
    parts.push({ type: "text", text: textContent });
    userContent = parts;
  } else {
    userContent = textContent;
  }

  messages.push({ role: "user", content: userContent });
  return messages;
}

async function saveMessages(
  sessionId,
  session,
  textContent,
  attachments,
  assistantText,
  usage,
  modelId,
  requestedModel,
  systemPromptId
) {
  const userMessage = {
    id: uuid(),
    role: "user",
    content: textContent,
    attachments,
    usage: null,
    error: null,
    createdAt: new Date().toISOString(),
  };

  const assistantMessage = {
    id: uuid(),
    role: "assistant",
    content: assistantText,
    attachments: [],
    usage,
    error: null,
    createdAt: new Date().toISOString(),
  };

  if (session) {
    const updatedMessages = [...session.messages, userMessage, assistantMessage];
    const title = session.messages.length === 0 && textContent
      ? textContent.slice(0, 60) + (textContent.length > 60 ? "..." : "")
      : session.title;
    const updates = { messages: updatedMessages, title };
    if (modelId !== requestedModel) {
      updates.model = modelId;
    }
    if (systemPromptId !== undefined) {
      updates.systemPromptId = systemPromptId;
    }
    await updateSession(sessionId, updates);
  }

  return { userMessage, assistantMessage };
}

// --- POST /api/chat (non-streaming) ---

router.post("/", async (req, res, next) => {
  try {
    const {
      sessionId,
      model: requestedModel,
      systemPromptId,
      messages: userMessages = [],
      params = {},
      attachments = [],
    } = req.body;

    const { modelId } = resolveModel(requestedModel, attachments);
    const systemContent = await resolveSystemPrompt(systemPromptId);

    let session = null;
    if (sessionId) {
      session = await getSessionById(sessionId);
      if (!session) {
        throw new AppError(ERROR_CODES.SESSION_NOT_FOUND, `Session ${sessionId} not found`, 404);
      }
    }

    const textContent = userMessages[userMessages.length - 1]?.content || "";
    const mimoMessages = buildMimoMessages(systemContent, session, textContent, attachments);

    const apiResponse = await chatCompletion({ model: modelId, messages: mimoMessages, params });
    const assistantText = apiResponse.choices?.[0]?.message?.content || "";
    const usage = apiResponse.usage || null;

    const { assistantMessage } = await saveMessages(
      sessionId,
      session,
      textContent,
      attachments,
      assistantText,
      usage,
      modelId,
      requestedModel,
      systemPromptId
    );

    res.json({ message: assistantMessage, session: session ? await getSessionById(sessionId) : null, modelUsed: modelId });
  } catch (err) {
    next(err);
  }
});

// --- POST /api/chat/stream (SSE streaming) ---

router.post("/stream", async (req, res, next) => {
  const requestId = uuid();
  const startTime = Date.now();

  try {
    const {
      sessionId,
      model: requestedModel,
      systemPromptId,
      messages: userMessages = [],
      params = {},
      attachments = [],
    } = req.body;

    const { modelId } = resolveModel(requestedModel, attachments);
    const systemContent = await resolveSystemPrompt(systemPromptId);

    let session = null;
    if (sessionId) {
      session = await getSessionById(sessionId);
      if (!session) {
        throw new AppError(ERROR_CODES.SESSION_NOT_FOUND, `Session ${sessionId} not found`, 404);
      }
    }

    const textContent = userMessages[userMessages.length - 1]?.content || "";
    const mimoMessages = buildMimoMessages(systemContent, session, textContent, attachments);

    // Set SSE headers
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    });

    // Send start event
    res.write(`event: start\ndata: ${JSON.stringify({ requestId, modelUsed: modelId })}\n\n`);

    // Get stream from MiMo
    const stream = await chatCompletionStream({ model: modelId, messages: mimoMessages, params });

    let accumulated = "";
    let usage = null;
    const decoder = new TextDecoder();
    let buffer = "";

    for await (const chunk of stream) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) continue;

        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") {
          // Stream finished — save to session
          const latencyMs = Date.now() - startTime;
          const { assistantMessage } = await saveMessages(
            sessionId,
            session,
            textContent,
            attachments,
            accumulated,
            usage,
            modelId,
            requestedModel,
            systemPromptId
          );

          const sessionData = session ? await getSessionById(sessionId) : null;
          res.write(`event: done\ndata: ${JSON.stringify({
            assistantMessage,
            session: sessionData,
            latencyMs,
            modelUsed: modelId,
          })}\n\n`);
          res.end();
          return;
        }

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta;

          if (delta?.content) {
            accumulated += delta.content;
            res.write(`event: delta\ndata: ${JSON.stringify({ contentDelta: delta.content })}\n\n`);
          }

          if (delta?.reasoning_content) {
            res.write(`event: delta\ndata: ${JSON.stringify({ reasoningDelta: delta.reasoning_content })}\n\n`);
          }

          if (parsed.usage) {
            usage = parsed.usage;
          }
        } catch {
          // Skip unparseable lines
        }
      }
    }

    // If we get here without [DONE], still finish
    const latencyMs = Date.now() - startTime;
    const { assistantMessage } = await saveMessages(
      sessionId,
      session,
      textContent,
      attachments,
      accumulated,
      usage,
      modelId,
      requestedModel,
      systemPromptId
    );
    const sessionData = session ? await getSessionById(sessionId) : null;
    res.write(`event: done\ndata: ${JSON.stringify({
      assistantMessage,
      session: sessionData,
      latencyMs,
      modelUsed: modelId,
    })}\n\n`);
    res.end();
  } catch (err) {
    const msg = err.message || "Stream failed";
    const status = err.status || 500;
    res.write(`event: error\ndata: ${JSON.stringify({ code: err.code || "STREAM_ERROR", message: msg, status })}\n\n`);
    res.end();
  }
});

export default router;
