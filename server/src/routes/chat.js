import { Router } from "express";
import { v4 as uuid } from "uuid";
import { MODELS, ERROR_CODES, getEnabledTools } from "../config.js";
import { getSessionById, updateSession, getPromptById } from "../storage.js";
import { chatCompletion, chatCompletionStream, AppError } from "../mimoClient.js";
import { tavilySearch } from "../tavilyClient.js";
import { firecrawlScrape } from "../firecrawlClient.js";

const MAX_TOOL_ITERATIONS = 3;

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
  systemPromptId,
  searchResults = null
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

  if (searchResults && searchResults.length > 0) {
    assistantMessage.searchResults = searchResults;
  }

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

// --- Tool execution ---

async function executeToolCall(toolCall) {
  const fnName = toolCall.function?.name;
  let args;
  try {
    args = JSON.parse(toolCall.function?.arguments || "{}");
  } catch {
    return { toolCallId: toolCall.id, result: { error: "Invalid tool arguments" } };
  }

  if (fnName === "web_search") {
    try {
      const result = await tavilySearch(args.query);
      return {
        toolCallId: toolCall.id,
        result,
        type: "search",
        query: args.query,
      };
    } catch (err) {
      return { toolCallId: toolCall.id, result: { error: err.message } };
    }
  }

  if (fnName === "scrape_url") {
    try {
      const result = await firecrawlScrape(args.url);
      return {
        toolCallId: toolCall.id,
        result,
        type: "scrape",
        url: args.url,
      };
    } catch (err) {
      return { toolCallId: toolCall.id, result: { error: err.message } };
    }
  }

  return { toolCallId: toolCall.id, result: { error: `Unknown tool: ${fnName}` } };
}

// --- Stream parser ---

async function* parseStream(stream) {
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
        yield { type: "done" };
        continue;
      }

      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta;

        yield {
          type: "delta",
          content: delta?.content || null,
          reasoningContent: delta?.reasoning_content || null,
          toolCalls: delta?.tool_calls || null,
          usage: parsed.usage || null,
          finishReason: parsed.choices?.[0]?.finish_reason || null,
        };
      } catch {
        // Skip unparseable lines
      }
    }
  }
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

// --- POST /api/chat/stream (SSE streaming with tool calling) ---

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
    const tools = getEnabledTools();

    // Set SSE headers
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    });

    res.write(`event: start\ndata: ${JSON.stringify({ requestId, modelUsed: modelId })}\n\n`);

    let accumulated = "";
    let usage = null;
    const allSearchResults = [];
    let currentMessages = [...mimoMessages];

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      const stream = await chatCompletionStream({
        model: modelId,
        messages: currentMessages,
        params: tools.length > 0 ? { ...params, tools } : params,
      });

      let hasToolCalls = false;
      const toolCallAccumulators = {};

      for await (const event of parseStream(stream)) {
        if (event.type === "done") {
          break;
        }

        if (event.type === "delta") {
          if (event.content) {
            accumulated += event.content;
            res.write(`event: delta\ndata: ${JSON.stringify({ contentDelta: event.content })}\n\n`);
          }

          if (event.reasoningContent) {
            res.write(`event: delta\ndata: ${JSON.stringify({ reasoningDelta: event.reasoningContent })}\n\n`);
          }

          if (event.toolCalls) {
            hasToolCalls = true;
            for (const tc of event.toolCalls) {
              const idx = tc.index ?? 0;
              if (!toolCallAccumulators[idx]) {
                toolCallAccumulators[idx] = {
                  id: tc.id || "",
                  type: "function",
                  function: { name: "", arguments: "" },
                };
              }
              const acc = toolCallAccumulators[idx];
              if (tc.id) acc.id = tc.id;
              if (tc.function?.name) acc.function.name = tc.function.name;
              if (tc.function?.arguments) acc.function.arguments += tc.function.arguments;
            }
          }

          if (event.usage) {
            usage = event.usage;
          }
        }
      }

      if (!hasToolCalls) {
        break;
      }

      // Execute tool calls
      const toolCallsArray = Object.values(toolCallAccumulators);

      // Build assistant message with tool_calls for context
      const assistantToolMsg = { role: "assistant", tool_calls: toolCallsArray, content: null };
      currentMessages.push(assistantToolMsg);

      for (const tc of toolCallsArray) {
        const fnName = tc.function?.name;

        // Notify client about search/scrape
        if (fnName === "web_search") {
          let query = "";
          try { query = JSON.parse(tc.function.arguments).query; } catch {}
          res.write(`event: searchStatus\ndata: ${JSON.stringify({ status: "searching", query })}\n\n`);
        } else if (fnName === "scrape_url") {
          let url = "";
          try { url = JSON.parse(tc.function.arguments).url; } catch {}
          res.write(`event: searchStatus\ndata: ${JSON.stringify({ status: "scraping", url })}\n\n`);
        }

        const toolResult = await executeToolCall(tc);

        // Collect search results for UI
        if (toolResult.type === "search" && toolResult.result?.results) {
          allSearchResults.push(...toolResult.result.results);
          res.write(`event: sources\ndata: ${JSON.stringify({ results: toolResult.result.results, query: toolResult.query })}\n\n`);
        } else if (toolResult.type === "scrape" && toolResult.result?.metadata) {
          allSearchResults.push({
            title: toolResult.result.metadata.title,
            url: toolResult.url,
            content: toolResult.result.metadata.description,
          });
        }

        // Add tool result to messages
        currentMessages.push({
          role: "tool",
          tool_call_id: toolResult.toolCallId,
          content: JSON.stringify(toolResult.result),
        });
      }
    }

    // Save and finish
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
      systemPromptId,
      allSearchResults
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
