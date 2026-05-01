export interface Model {
  id: string;
  provider: "mimo" | "deepseek";
  label: string;
  supportsText: boolean;
  supportsImages: boolean;
  supportsThinking: boolean;
  defaultFor: "text" | "image" | null;
}

export interface Prompt {
  id: string;
  title: string;
  content: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Attachment {
  id: string;
  mimeType: string;
  size: number;
  fileName: string;
  dataUrl?: string;
}

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  completion_tokens_details?: { reasoning_tokens?: number };
  prompt_tokens_details?: { cached_tokens?: number; image_tokens?: number };
}

export interface SearchResult {
  title: string;
  url: string;
  content: string;
  score?: number;
}

export interface SearchStatus {
  status: "searching" | "scraping";
  query?: string;
  url?: string;
}

export type MessageStatus = "complete" | "thinking" | "streaming" | "error";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments: Attachment[];
  usage: Usage | null;
  error: string | null;
  createdAt: string;
  status?: MessageStatus;
  searchResults?: SearchResult[];
  reasoningContent?: string | null;
}

export interface Session {
  id: string;
  title: string;
  model: string;
  systemPromptId: string | null;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

export interface SessionSummary {
  id: string;
  title: string;
  model: string;
  systemPromptId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatParams {
  temperature: number;
  top_p: number;
  max_completion_tokens?: number;
}

export type ChatStatus = "idle" | "uploading" | "sending" | "streaming" | "error";

export interface ChatRequest {
  sessionId: string;
  model: string;
  systemPromptId?: string;
  messages: { role: "user"; content: string }[];
  params?: ChatParams;
  attachments?: Attachment[];
  thinking?: { type: "enabled" | "disabled" };
  reasoning_effort?: "high" | "max";
}

export interface ChatResponse {
  message: Message;
  session: Session | null;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    providerStatus?: number;
  };
}
