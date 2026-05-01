import type {
  Model,
  Prompt,
  Session,
  SessionSummary,
  ChatRequest,
  ChatResponse,
  Attachment,
  Message,
  SearchResult,
  SearchStatus,
} from "../types";

const BASE = "/api";

export interface HealthData {
  ok: boolean;
  apiKeyConfigured: boolean;
  providerBaseUrl: string;
}

export async function fetchHealth(): Promise<HealthData> {
  const res = await fetch(`${BASE}/health`);
  return res.json();
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  const data = await res.json();
  if (!res.ok) {
    throw data;
  }
  return data as T;
}

// Models
export function fetchModels(): Promise<Model[]> {
  return request("/models");
}

// Prompts
export function fetchPrompts(): Promise<Prompt[]> {
  return request("/prompts");
}

export function createPrompt(data: {
  title: string;
  content: string;
  isDefault?: boolean;
}): Promise<Prompt> {
  return request("/prompts", { method: "POST", body: JSON.stringify(data) });
}

export function updatePrompt(
  id: string,
  data: Partial<{ title: string; content: string; isDefault: boolean }>
): Promise<Prompt> {
  return request(`/prompts/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deletePrompt(id: string): Promise<{ ok: boolean }> {
  return request(`/prompts/${id}`, { method: "DELETE" });
}

// Sessions
export function fetchSessions(): Promise<SessionSummary[]> {
  return request("/sessions");
}

export function fetchSession(id: string): Promise<Session> {
  return request(`/sessions/${id}`);
}

export function createSession(data: {
  title?: string;
  model?: string;
  systemPromptId?: string;
}): Promise<Session> {
  return request("/sessions", { method: "POST", body: JSON.stringify(data) });
}

export function updateSession(
  id: string,
  data: Partial<Pick<Session, "title" | "model" | "systemPromptId">>
): Promise<Session> {
  return request(`/sessions/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export function deleteSession(id: string): Promise<{ ok: boolean }> {
  return request(`/sessions/${id}`, { method: "DELETE" });
}

// Chat (non-streaming)
export function sendChat(data: ChatRequest): Promise<ChatResponse> {
  return request("/chat", { method: "POST", body: JSON.stringify(data) });
}

// Chat (SSE streaming)
export interface StreamCallbacks {
  onStart?: (info: { modelUsed: string }) => void;
  onDelta: (contentDelta: string, reasoningDelta?: string) => void;
  onSearchStatus?: (status: SearchStatus) => void;
  onSources?: (results: SearchResult[], query?: string) => void;
  onDone: (result: {
    assistantMessage: Message;
    session: Session | null;
    latencyMs: number;
    modelUsed: string;
  }) => void;
  onError: (error: { code: string; message: string; status?: number }) => void;
}

export async function sendChatStream(
  data: ChatRequest,
  callbacks: StreamCallbacks
): Promise<void> {
  const res = await fetch(`${BASE}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res
      .json()
      .catch(() => ({
        error: { code: "FETCH_ERROR", message: "Stream request failed" },
      }));
    callbacks.onError(
      err.error || { code: "FETCH_ERROR", message: "Stream request failed" }
    );
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    callbacks.onError({ code: "NO_READER", message: "Cannot read stream" });
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.startsWith("event:")) {
          currentEvent = trimmed.slice(6).trim();
          continue;
        }

        if (trimmed.startsWith("data:")) {
          const dataStr = trimmed.slice(5).trim();

          if (currentEvent === "delta") {
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.contentDelta) {
                callbacks.onDelta(parsed.contentDelta, parsed.reasoningDelta);
              }
            } catch {
              // skip
            }
          } else if (currentEvent === "start") {
            try {
              const parsed = JSON.parse(dataStr);
              callbacks.onStart?.(parsed);
            } catch {
              // skip
            }
          } else if (currentEvent === "done") {
            try {
              const parsed = JSON.parse(dataStr);
              callbacks.onDone(parsed);
            } catch {
              // skip
            }
          } else if (currentEvent === "error") {
            try {
              const parsed = JSON.parse(dataStr);
              callbacks.onError(parsed);
            } catch {
              // skip
            }
          } else if (currentEvent === "searchStatus") {
            try {
              const parsed = JSON.parse(dataStr);
              callbacks.onSearchStatus?.(parsed);
            } catch {
              // skip
            }
          } else if (currentEvent === "sources") {
            try {
              const parsed = JSON.parse(dataStr);
              callbacks.onSources?.(parsed.results, parsed.query);
            } catch {
              // skip
            }
          }

          currentEvent = "";
        }
      }
    }
  } catch (e) {
    callbacks.onError({
      code: "READ_ERROR",
      message: e instanceof Error ? e.message : "Stream read failed",
    });
  }
}

// Uploads
export async function uploadImage(file: File): Promise<Attachment> {
  const form = new FormData();
  form.append("image", file);
  const res = await fetch(`${BASE}/uploads`, { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok) throw data;
  return data as Attachment;
}
