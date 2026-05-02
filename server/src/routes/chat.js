import { Router } from "express";
import { v4 as uuid } from "uuid";
import {
  FIRECRAWL_ENABLED,
  TAVILY_ENABLED,
  TAVILY_API_KEY,
  FIRECRAWL_API_KEY,
  ERROR_CODES,
  getEnabledTools,
  getModelById,
} from "../config.js";
import { getSessionById, updateSession, getPromptById } from "../storage.js";
import { chatCompletion, chatCompletionStream, AppError } from "../mimoClient.js";
import {
  chatCompletion as deepseekChat,
  chatCompletionStream as deepseekStream,
} from "../deepseekClient.js";
import { runWebSearch, runWebExtract } from "../webTools.js";

const MAX_TOOL_ITERATIONS = 4;
const MAX_WEB_RESULTS = 5;
const MAX_SCRAPE_URLS = 2;
const WEB_INTENT_RE =
  /\b(today|current|latest|recent|now|news|price|rate|exchange|weather)\b|курс|гривн|долар|євро|евро|рубл|сьогодні|сегодня|зараз|сейчас|актуальн|поточн|текущ|останні|последн|новини|новости|ціна|цена/i;
const URL_RE = /https?:\/\/[^\s)]+/gi;

const router = Router();

// --- Shared helpers ---

function resolveModel(requestedModel, attachments) {
  const imageAttachments = attachments.filter((attachment) => attachment.dataUrl);
  let modelId = requestedModel || (imageAttachments.length > 0 ? "mimo-v2.5" : "mimo-v2.5-pro");
  let modelConfig = getModelById(modelId);

  if (!modelConfig) {
    throw new AppError(ERROR_CODES.INVALID_MODEL, `Unknown model: ${modelId}`, 400);
  }

  if (imageAttachments.length > 0 && !modelConfig.supportsImages) {
    const fallback = getModelById("mimo-v2.5");
    if (fallback) {
      modelId = fallback.id;
      modelConfig = fallback;
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

function buildMessages(systemContent, session, textContent, attachments, historyImages = null) {
  const messages = [];

  if (systemContent) {
    messages.push({ role: "system", content: systemContent });
  }

  if (session) {
    for (const msg of session.messages) {
      const images = historyImages?.[msg.id];
      if (images && images.length > 0) {
        const parts = [];
        for (const url of images) {
          parts.push({ type: "image_url", image_url: { url } });
        }
        if (msg.content) {
          parts.push({ type: "text", text: msg.content });
        }
        messages.push({ role: msg.role, content: parts });
      } else {
        messages.push({ role: msg.role, content: msg.content });
      }
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

function addWebContext(messages, context) {
  if (!context) return messages;

  const contextMessage = { role: "system", content: context };
  const hasSystem = messages[0]?.role === "system";
  if (!hasSystem) return [contextMessage, ...messages];

  return [messages[0], contextMessage, ...messages.slice(1)];
}

function buildApiParams(requestParams, modelConfig) {
  if (modelConfig.supportsThinking && requestParams.thinking) {
    const { thinking, reasoning_effort, ...rest } = requestParams;
    const params = { thinking };
    if (reasoning_effort) params.reasoning_effort = reasoning_effort;
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined) params[k] = v;
    }
    return params;
  }
  return { ...requestParams };
}

function callChat(modelConfig, args) {
  if (modelConfig.provider === "deepseek") return deepseekChat(args);
  return chatCompletion(args);
}

function callStream(modelConfig, args) {
  if (modelConfig.provider === "deepseek") return deepseekStream(args);
  return chatCompletionStream(args);
}

function getUrls(text) {
  return [...(text.match(URL_RE) || [])]
    .map((url) => url.replace(/[.,;!?]+$/, ""))
    .filter((url, index, urls) => urls.indexOf(url) === index)
    .slice(0, MAX_SCRAPE_URLS);
}

function shouldSearchWeb(text) {
  const searchAvailable = (TAVILY_ENABLED && !!TAVILY_API_KEY) || (FIRECRAWL_ENABLED && !!FIRECRAWL_API_KEY);
  return searchAvailable && WEB_INTENT_RE.test(text);
}

function formatSearchContext(results) {
  return results
    .map((result, index) => {
      const title = result.title || "Untitled";
      const url = result.url || "";
      const content = result.content || "";
      return `[${index + 1}] ${title}\nURL: ${url}\n${content}`;
    })
    .join("\n\n");
}

async function buildWebContext(textContent, notify = null, webCache = null) {
  const contextParts = [];
  const sources = [];
  const urls = getUrls(textContent);

  const extractAvailable = (TAVILY_ENABLED && !!TAVILY_API_KEY) || (FIRECRAWL_ENABLED && !!FIRECRAWL_API_KEY);

  if (extractAvailable && urls.length > 0) {
    for (const url of urls) {
      notify?.({ status: "scraping", url });
      try {
        const result = await runWebExtract({ urls: url, provider: "auto", cache: webCache });
        const page = result.results?.[0];
        if (page) {
          const title = page.title || page.metadata?.title || url;
          const content = (page.content || page.markdown || "").slice(0, 6000);
          contextParts.push(`Scraped page: ${title}\nURL: ${url}\n${content}`);
          sources.push({
            title,
            url,
            content: page.metadata?.description || content.slice(0, 300),
          });
        }
      } catch (err) {
        contextParts.push(`Scrape failed for ${url}: ${err.message}`);
      }
    }
  }

  if (shouldSearchWeb(textContent)) {
    notify?.({ status: "searching", query: textContent });
    try {
      const search = await runWebSearch({ query: textContent, provider: "auto", options: { max_results: MAX_WEB_RESULTS }, cache: webCache });
      if (search.results.length > 0) {
        contextParts.push(`Web search results for: ${textContent}\n${formatSearchContext(search.results)}`);
        sources.push(...search.results);
      }
    } catch (err) {
      contextParts.push(`Web search failed: ${err.message}`);
    }
  }

  if (contextParts.length === 0) {
    return { context: null, sources };
  }

  return {
    context:
      `Current web context was fetched by the server at ${new Date().toISOString()}.\n` +
      "Use it to answer the user. Cite source URLs when relevant. Do not say you lack internet access if this context answers the question.\n\n" +
      contextParts.join("\n\n---\n\n"),
    sources,
  };
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
  searchResults = null,
  reasoningContent = null
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

  if (reasoningContent) {
    assistantMessage.reasoningContent = reasoningContent;
  }

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

async function executeToolCall(toolCall, webCache = null) {
  const fnName = toolCall.function?.name;
  let args;
  try {
    args = JSON.parse(toolCall.function?.arguments || "{}");
  } catch {
    return { toolCallId: toolCall.id, result: { error: "Invalid tool arguments" } };
  }

  if (fnName === "web_search") {
    try {
      const result = await runWebSearch({
        query: args.query,
        provider: args.provider || "auto",
        options: args.maxResults ? { max_results: args.maxResults } : {},
        cache: webCache,
      });
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

  if (fnName === "web_extract") {
    try {
      const urls = args.urls || (args.url ? [args.url] : []);
      if (urls.length === 0) {
        return { toolCallId: toolCall.id, result: { error: "No URLs provided" } };
      }
      const result = await runWebExtract({
        urls,
        provider: args.provider || "auto",
        options: args.format ? { format: args.format } : {},
        cache: webCache,
      });
      return {
        toolCallId: toolCall.id,
        result,
        type: "extract",
        urls,
      };
    } catch (err) {
      return { toolCallId: toolCall.id, result: { error: err.message } };
    }
  }

  if (fnName === "scrape_url") {
    try {
      const result = await runWebExtract({
        urls: args.url,
        provider: "auto",
        cache: webCache,
      });
      return {
        toolCallId: toolCall.id,
        result: {
          provider: result.provider,
          markdown: result.results?.[0]?.content || result.results?.[0]?.markdown || "",
          metadata: result.results?.[0]?.metadata || { title: result.results?.[0]?.title, sourceURL: args.url },
        },
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
      historyImages = null,
    } = req.body;

    const { modelId, modelConfig } = resolveModel(requestedModel, attachments);
    const systemContent = await resolveSystemPrompt(systemPromptId);

    let session = null;
    if (sessionId) {
      session = await getSessionById(sessionId);
      if (!session) {
        throw new AppError(ERROR_CODES.SESSION_NOT_FOUND, `Session ${sessionId} not found`, 404);
      }
    }

    const textContent = userMessages[userMessages.length - 1]?.content || "";
    const webCache = new Map();
    const webContext = await buildWebContext(textContent, null, webCache);
    const mimoMessages = addWebContext(
      buildMessages(systemContent, session, textContent, attachments, historyImages),
      webContext.context
    );

    const apiParams = buildApiParams(params, modelConfig);
    const apiResponse = await callChat(modelConfig, { model: modelId, messages: mimoMessages, params: apiParams });
    const assistantText = apiResponse.choices?.[0]?.message?.content || "";
    const reasoningText = apiResponse.choices?.[0]?.message?.reasoning_content || null;
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
      systemPromptId,
      webContext.sources,
      reasoningText
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
      historyImages = null,
    } = req.body;

    const { modelId, modelConfig } = resolveModel(requestedModel, attachments);
    const systemContent = await resolveSystemPrompt(systemPromptId);

    let session = null;
    if (sessionId) {
      session = await getSessionById(sessionId);
      if (!session) {
        throw new AppError(ERROR_CODES.SESSION_NOT_FOUND, `Session ${sessionId} not found`, 404);
      }
    }

    const textContent = userMessages[userMessages.length - 1]?.content || "";
    const mimoMessages = buildMessages(systemContent, session, textContent, attachments, historyImages);
    const tools = getEnabledTools();
    const webCache = new Map();

    // Set SSE headers
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    });

    res.write(`event: start\ndata: ${JSON.stringify({ requestId, modelUsed: modelId })}\n\n`);

    let accumulated = "";
    let accumulatedReasoning = "";
    let usage = null;
    const allSearchResults = [];

    const webContext = await buildWebContext(textContent, (status) => {
      res.write(`event: searchStatus\ndata: ${JSON.stringify(status)}\n\n`);
    }, webCache);
    allSearchResults.push(...webContext.sources);

    let currentMessages = addWebContext(mimoMessages, webContext.context);
    const apiParams = buildApiParams(params, modelConfig);
    let lastFinishReason = null;

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      const isFinalIteration = iteration === MAX_TOOL_ITERATIONS - 1;
      const streamParams = (tools.length > 0 && !isFinalIteration)
        ? { ...apiParams, tools }
        : apiParams;
      const stream = await callStream(modelConfig, {
        model: modelId,
        messages: currentMessages,
        params: streamParams,
      });

      let turnReasoning = "";
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
            turnReasoning += event.reasoningContent;
            accumulatedReasoning += event.reasoningContent;
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

          if (event.finishReason) {
            lastFinishReason = event.finishReason;
          }
        }
      }

      if (!hasToolCalls) {
        break;
      }

      if (isFinalIteration) {
        // Tools were not offered on this iteration; ignore any phantom tool_calls.
        console.warn(`[chat-stream] model emitted tool_calls on final iteration; ignoring`);
        break;
      }

      // Execute tool calls
      const toolCallsArray = Object.values(toolCallAccumulators);

      // Build assistant message with tool_calls for context
      const assistantToolMsg = { role: "assistant", tool_calls: toolCallsArray, content: null };
      if (turnReasoning && modelConfig.supportsThinking) {
        assistantToolMsg.reasoning_content = turnReasoning;
      }
      currentMessages.push(assistantToolMsg);

      for (const tc of toolCallsArray) {
        const fnName = tc.function?.name;

        // Notify client about search/extract/scrape
        if (fnName === "web_search") {
          let query = "";
          try { query = JSON.parse(tc.function.arguments).query; } catch {}
          res.write(`event: searchStatus\ndata: ${JSON.stringify({ status: "searching", query })}\n\n`);
        } else if (fnName === "web_extract") {
          let extractUrl = "";
          try {
            const a = JSON.parse(tc.function.arguments);
            extractUrl = a.url || (a.urls && a.urls[0]) || "";
          } catch {}
          res.write(`event: searchStatus\ndata: ${JSON.stringify({ status: "scraping", url: extractUrl })}\n\n`);
        } else if (fnName === "scrape_url") {
          let url = "";
          try { url = JSON.parse(tc.function.arguments).url; } catch {}
          res.write(`event: searchStatus\ndata: ${JSON.stringify({ status: "scraping", url })}\n\n`);
        }

        const toolResult = await executeToolCall(tc, webCache);

        // Collect search results for UI
        if (toolResult.type === "search" && toolResult.result?.results) {
          allSearchResults.push(...toolResult.result.results);
          res.write(`event: sources\ndata: ${JSON.stringify({ results: toolResult.result.results, query: toolResult.query })}\n\n`);
        } else if (toolResult.type === "extract" && toolResult.result?.results) {
          for (const r of toolResult.result.results) {
            allSearchResults.push({
              title: r.title || r.metadata?.title,
              url: r.url || r.metadata?.sourceURL,
              content: r.metadata?.description || (r.content || r.markdown || "").slice(0, 300),
            });
          }
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

    // Empty-response handling: surface a friendly error instead of saving a blank message.
    if (!accumulated.trim()) {
      let errorMessage;
      let errorCode;
      if (lastFinishReason === "content_filter") {
        errorCode = "CONTENT_FILTERED";
        errorMessage = "Provider blocked this response due to content policy. Try rephrasing.";
      } else if (allSearchResults.length > 0) {
        errorCode = "EMPTY_AFTER_SEARCH";
        errorMessage = "Model didn't produce a response after searching. Try rephrasing or regenerate.";
      } else {
        errorCode = "EMPTY_RESPONSE";
        errorMessage = "Model returned an empty response. Try again or rephrase.";
      }
      console.warn(`[chat-stream] empty response (finish=${lastFinishReason}, sources=${allSearchResults.length})`);
      res.write(`event: error\ndata: ${JSON.stringify({
        code: errorCode,
        message: errorMessage,
        status: 502,
      })}\n\n`);
      res.end();
      return;
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
      allSearchResults,
      accumulatedReasoning || null
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
