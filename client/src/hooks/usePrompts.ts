import { useCallback } from "react";
import { useApp } from "../context/AppContext";
import * as api from "../api/client";
import type { Prompt } from "../types";

export function usePrompts() {
  const { state, dispatch } = useApp();

  const loadPrompts = useCallback(async () => {
    const prompts = await api.fetchPrompts();
    dispatch({ type: "SET_PROMPTS", payload: prompts });
  }, [dispatch]);

  const addPrompt = useCallback(
    async (data: { title: string; content: string; isDefault?: boolean }) => {
      const prompt = await api.createPrompt(data);
      await loadPrompts();
      return prompt;
    },
    [loadPrompts]
  );

  const editPrompt = useCallback(
    async (id: string, data: Partial<Prompt>) => {
      const prompt = await api.updatePrompt(id, data);
      await loadPrompts();
      return prompt;
    },
    [loadPrompts]
  );

  const removePrompt = useCallback(
    async (id: string) => {
      await api.deletePrompt(id);
      await loadPrompts();
    },
    [loadPrompts]
  );

  return {
    prompts: state.prompts,
    loadPrompts,
    addPrompt,
    editPrompt,
    removePrompt,
  };
}
