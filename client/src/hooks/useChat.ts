import { useCallback } from "react";
import { v4 as uuid } from "uuid";
import { useApp } from "../context/AppContext";
import * as api from "../api/client";
import { getImage } from "../lib/imageStore";
import type { Attachment, ChatParams, Message } from "../types";

async function collectHistoryImages(
  messages: Message[]
): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {};
  for (const msg of messages) {
    if (msg.attachments.length === 0) continue;
    const urls: string[] = [];
    for (const att of msg.attachments) {
      if (att.dataUrl) {
        urls.push(att.dataUrl);
        continue;
      }
      try {
        const cached = await getImage(att.id);
        if (cached?.dataUrl) urls.push(cached.dataUrl);
      } catch {
        // skip
      }
    }
    if (urls.length > 0) out[msg.id] = urls;
  }
  return out;
}

export function useChat() {
  const { state, dispatch } = useApp();

  const sendStream = useCallback(
    async (opts: {
      sessionId: string;
      model: string;
      systemPromptId?: string;
      text: string;
      attachments?: Attachment[];
      params?: ChatParams;
      appendUser: boolean;
    }): Promise<boolean> => {
      const now = Date.now();
      dispatch({ type: "SET_REQUEST_STARTED", payload: now });
      dispatch({ type: "SET_LAST_ERROR", payload: null });

      if (opts.appendUser) {
        const userMsg: Message = {
          id: uuid(),
          role: "user",
          content: opts.text,
          attachments: opts.attachments || [],
          usage: null,
          error: null,
          createdAt: new Date().toISOString(),
          status: "complete",
        };
        dispatch({ type: "APPEND_MESSAGE", payload: userMsg });
      }

      const assistantPlaceholder: Message = {
        id: uuid(),
        role: "assistant",
        content: "",
        attachments: [],
        usage: null,
        error: null,
        createdAt: new Date().toISOString(),
        status: "thinking",
      };
      dispatch({ type: "APPEND_MESSAGE", payload: assistantPlaceholder });

      const sendableAttachments = opts.attachments?.filter((attachment) => attachment.dataUrl);
      const hasImages = (sendableAttachments?.length ?? 0) > 0;
      const effectiveModel = hasImages ? "mimo-v2.5" : opts.model;

      if (hasImages && opts.model !== "mimo-v2.5" && state.activeSession) {
        dispatch({
          type: "SET_ACTIVE_SESSION",
          payload: { ...state.activeSession, model: "mimo-v2.5" },
        });
      }

      const modelConfig = state.models.find((m) => m.id === effectiveModel);
      const isThinkingModel = modelConfig?.supportsThinking ?? false;

      dispatch({ type: "SET_CHAT_STATUS", payload: "streaming" });

      // Collect images from prior turns so the model can see them again.
      // Excludes the just-appended user/assistant placeholder (they have live dataUrls already).
      const priorMessages = state.activeSession?.messages || [];
      const historyImages = await collectHistoryImages(priorMessages);

      let resolved = false;

      await api.sendChatStream(
        {
          sessionId: opts.sessionId,
          model: effectiveModel,
          systemPromptId: opts.systemPromptId,
          messages: [{ role: "user", content: opts.text }],
          params: opts.params,
          attachments: sendableAttachments,
          historyImages: Object.keys(historyImages).length > 0 ? historyImages : undefined,
          ...(isThinkingModel && state.thinkingEnabled
            ? {
                thinking: { type: "enabled" },
                reasoning_effort: state.reasoningEffort,
              }
            : isThinkingModel
              ? { thinking: { type: "disabled" } }
              : {}),
        },
        {
          onStart: (info) => {
            console.log("[stream] start:", info.modelUsed);
          },

          onDelta: (contentDelta) => {
            dispatch({ type: "APPEND_DELTA", payload: contentDelta });
          },

          onSearchStatus: (status) => {
            dispatch({ type: "SET_SEARCH_STATUS", payload: status });
          },

          onSources: (_results, _query) => {
            // Sources are stored in the message after done
          },

          onDone: (result) => {
            resolved = true;
            const latency = Date.now() - now;
            dispatch({ type: "SET_LATENCY", payload: latency });
            dispatch({ type: "SET_SEARCH_STATUS", payload: null });

            // Replace with final data
            dispatch({
              type: "UPDATE_LAST_MESSAGE",
              payload: {
                content: result.assistantMessage.content,
                usage: result.assistantMessage.usage,
                status: "complete",
                searchResults: result.assistantMessage.searchResults,
                reasoningContent: result.assistantMessage.reasoningContent,
              },
            });

            if (result.session) {
              dispatch({ type: "SET_ACTIVE_SESSION", payload: result.session });
            }

            dispatch({ type: "SET_CHAT_STATUS", payload: "idle" });
          },

          onError: (error) => {
            resolved = true;
            dispatch({ type: "SET_LAST_ERROR", payload: error.message });
            dispatch({ type: "SET_CHAT_STATUS", payload: "error" });
            dispatch({ type: "SET_SEARCH_STATUS", payload: null });
            dispatch({
              type: "UPDATE_LAST_MESSAGE",
              payload: { status: "error", error: error.message },
            });
          },
        }
      );

      // Fallback if stream ended without done/error
      if (!resolved) {
        dispatch({ type: "SET_CHAT_STATUS", payload: "idle" });
      }

      return resolved;
    },
    [state.activeSession, state.models, state.thinkingEnabled, state.reasoningEffort, dispatch]
  );

  const sendMessage = useCallback(
    (opts: {
      sessionId: string;
      model: string;
      systemPromptId?: string;
      text: string;
      attachments?: Attachment[];
      params?: ChatParams;
    }) => sendStream({ ...opts, appendUser: true }),
    [sendStream]
  );

  const regenerateMessage = useCallback(
    async (assistantMessageId: string): Promise<boolean> => {
      const session = state.activeSession;
      if (!session || state.chatStatus === "streaming") return false;

      const assistantIndex = session.messages.findIndex(
        (msg) => msg.id === assistantMessageId
      );
      const userMessage = session.messages[assistantIndex - 1];
      if (
        assistantIndex < 1 ||
        !userMessage ||
        userMessage.role !== "user"
      ) {
        return false;
      }

      dispatch({ type: "REMOVE_MESSAGE", payload: assistantMessageId });

      return sendStream({
        sessionId: session.id,
        model: session.model,
        systemPromptId: session.systemPromptId || undefined,
        text: userMessage.content,
        attachments:
          userMessage.attachments.length > 0 ? userMessage.attachments : undefined,
        params: state.chatParams,
        appendUser: false,
      });
    },
    [state.activeSession, state.chatParams, state.chatStatus, dispatch, sendStream]
  );

  return {
    sendMessage,
    regenerateMessage,
    chatStatus: state.chatStatus,
    lastLatencyMs: state.lastLatencyMs,
    lastError: state.lastError,
  };
}
