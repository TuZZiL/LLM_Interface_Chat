import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  type ReactNode,
  type Dispatch,
} from "react";
import type {
  ChatParams,
  ChatStatus,
  Message,
  Model,
  Prompt,
  SearchStatus,
  Session,
  SessionSummary,
} from "../types";
import * as api from "../api/client";

interface AppState {
  models: Model[];
  prompts: Prompt[];
  sessions: SessionSummary[];
  activeSessionId: string | null;
  activeSession: Session | null;
  chatParams: ChatParams;
  chatStatus: ChatStatus;
  lastLatencyMs: number | null;
  lastError: string | null;
  requestStartedAt: number | null;
  searchStatus: SearchStatus | null;
  thinkingEnabled: boolean;
  reasoningEffort: "high" | "max";
}

type Action =
  | { type: "SET_MODELS"; payload: Model[] }
  | { type: "SET_PROMPTS"; payload: Prompt[] }
  | { type: "SET_SESSIONS"; payload: SessionSummary[] }
  | { type: "SET_ACTIVE_SESSION"; payload: Session | null }
  | { type: "ADD_SESSION"; payload: SessionSummary }
  | { type: "DELETE_SESSION"; payload: string }
  | { type: "SET_PARAMS"; payload: Partial<ChatParams> }
  | { type: "SET_CHAT_STATUS"; payload: ChatStatus }
  | { type: "SET_LATENCY"; payload: number }
  | { type: "SET_LAST_ERROR"; payload: string | null }
  | { type: "SET_REQUEST_STARTED"; payload: number | null }
  | { type: "SET_SEARCH_STATUS"; payload: SearchStatus | null }
  | { type: "SET_THINKING"; payload: boolean }
  | { type: "SET_REASONING_EFFORT"; payload: "high" | "max" }
  | { type: "APPEND_MESSAGE"; payload: Message }
  | { type: "APPEND_DELTA"; payload: string }
  | { type: "UPDATE_LAST_MESSAGE"; payload: Partial<Message> }
  | { type: "REMOVE_MESSAGE"; payload: string }
  | { type: "CLEAR_ACTIVE_MESSAGES" };

const initialState: AppState = {
  models: [],
  prompts: [],
  sessions: [],
  activeSessionId: null,
  activeSession: null,
  chatParams: { temperature: 1, top_p: 0.95 },
  chatStatus: "idle",
  lastLatencyMs: null,
  lastError: null,
  requestStartedAt: null,
  searchStatus: null,
  thinkingEnabled: true,
  reasoningEffort: "high",
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "SET_MODELS":
      return { ...state, models: action.payload };
    case "SET_PROMPTS":
      return { ...state, prompts: action.payload };
    case "SET_SESSIONS":
      return { ...state, sessions: action.payload };
    case "SET_ACTIVE_SESSION":
      return {
        ...state,
        activeSession: action.payload,
        activeSessionId: action.payload?.id ?? null,
      };
    case "ADD_SESSION":
      return { ...state, sessions: [action.payload, ...state.sessions] };
    case "DELETE_SESSION":
      return {
        ...state,
        sessions: state.sessions.filter((s) => s.id !== action.payload),
        activeSession:
          state.activeSessionId === action.payload ? null : state.activeSession,
        activeSessionId:
          state.activeSessionId === action.payload
            ? null
            : state.activeSessionId,
      };
    case "SET_PARAMS":
      return {
        ...state,
        chatParams: { ...state.chatParams, ...action.payload },
      };
    case "SET_CHAT_STATUS":
      return { ...state, chatStatus: action.payload };
    case "SET_LATENCY":
      return { ...state, lastLatencyMs: action.payload };
    case "SET_LAST_ERROR":
      return { ...state, lastError: action.payload };
    case "SET_REQUEST_STARTED":
      return { ...state, requestStartedAt: action.payload };
    case "SET_SEARCH_STATUS":
      return { ...state, searchStatus: action.payload };
    case "SET_THINKING":
      return { ...state, thinkingEnabled: action.payload };
    case "SET_REASONING_EFFORT":
      return { ...state, reasoningEffort: action.payload };
    case "APPEND_MESSAGE":
      if (!state.activeSession) return state;
      return {
        ...state,
        activeSession: {
          ...state.activeSession,
          messages: [...state.activeSession.messages, action.payload],
        },
      };
    case "APPEND_DELTA":
      if (!state.activeSession) return state;
      const deltaMsgs = state.activeSession.messages;
      if (deltaMsgs.length === 0) return state;
      const deltaUpdated = [...deltaMsgs];
      const lastMsg = deltaUpdated[deltaMsgs.length - 1];
      deltaUpdated[deltaMsgs.length - 1] = {
        ...lastMsg,
        content: lastMsg.content + action.payload,
        status: "streaming",
      };
      return {
        ...state,
        activeSession: { ...state.activeSession, messages: deltaUpdated },
      };
    case "UPDATE_LAST_MESSAGE":
      if (!state.activeSession) return state;
      const msgs = state.activeSession.messages;
      if (msgs.length === 0) return state;
      const updated = [...msgs];
      updated[msgs.length - 1] = {
        ...updated[msgs.length - 1],
        ...action.payload,
      };
      return {
        ...state,
        activeSession: { ...state.activeSession, messages: updated },
      };
    case "REMOVE_MESSAGE":
      if (!state.activeSession) return state;
      return {
        ...state,
        activeSession: {
          ...state.activeSession,
          messages: state.activeSession.messages.filter(
            (msg) => msg.id !== action.payload
          ),
        },
      };
    case "CLEAR_ACTIVE_MESSAGES":
      if (!state.activeSession) return state;
      return {
        ...state,
        activeSession: { ...state.activeSession, messages: [] },
      };
    default:
      return state;
  }
}

const AppContext = createContext<{
  state: AppState;
  dispatch: Dispatch<Action>;
} | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    api
      .fetchModels()
      .then((m) => dispatch({ type: "SET_MODELS", payload: m }));
    api
      .fetchPrompts()
      .then((p) => dispatch({ type: "SET_PROMPTS", payload: p }));
    api
      .fetchSessions()
      .then((s) => dispatch({ type: "SET_SESSIONS", payload: s }));
  }, []);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
