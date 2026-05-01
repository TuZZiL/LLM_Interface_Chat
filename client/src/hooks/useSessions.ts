import { useCallback } from "react";
import { useApp } from "../context/AppContext";
import * as api from "../api/client";
import type { Session } from "../types";

export function useSessions() {
  const { state, dispatch } = useApp();

  const loadSessions = useCallback(async () => {
    const sessions = await api.fetchSessions();
    dispatch({ type: "SET_SESSIONS", payload: sessions });
  }, [dispatch]);

  const selectSession = useCallback(
    async (id: string) => {
      try {
        const session = await api.fetchSession(id);
        dispatch({ type: "SET_ACTIVE_SESSION", payload: session });
      } catch (e: unknown) {
        console.error("Failed to load session:", e);
      }
    },
    [dispatch]
  );

  const addSession = useCallback(
    async (model: string, systemPromptId?: string) => {
      const session = await api.createSession({ model, systemPromptId });
      dispatch({
        type: "ADD_SESSION",
        payload: {
          id: session.id,
          title: session.title,
          model: session.model,
          systemPromptId: session.systemPromptId,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
        },
      });
      dispatch({ type: "SET_ACTIVE_SESSION", payload: session });
      return session;
    },
    [dispatch]
  );

  const removeSession = useCallback(
    async (id: string) => {
      await api.deleteSession(id);
      dispatch({ type: "DELETE_SESSION", payload: id });
    },
    [dispatch]
  );

  const updateActiveSession = useCallback(
    async (session: Session) => {
      dispatch({ type: "SET_ACTIVE_SESSION", payload: session });
      try {
        const saved = await api.updateSession(session.id, {
          title: session.title,
          model: session.model,
          systemPromptId: session.systemPromptId,
        });
        dispatch({ type: "SET_ACTIVE_SESSION", payload: saved });
        await loadSessions();
        return saved;
      } catch (e: unknown) {
        console.error("Failed to update session:", e);
        await loadSessions();
        return null;
      }
    },
    [dispatch, loadSessions]
  );

  return {
    sessions: state.sessions,
    activeSession: state.activeSession,
    activeSessionId: state.activeSessionId,
    loadSessions,
    selectSession,
    addSession,
    removeSession,
    updateActiveSession,
  };
}
