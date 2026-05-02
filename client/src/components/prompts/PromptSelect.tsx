import { usePrompts } from "../../hooks/usePrompts";
import { useSessions } from "../../hooks/useSessions";
import { useApp } from "../../context/AppContext";

export function PromptSelect() {
  const { prompts } = usePrompts();
  const { activeSession, updateActiveSession } = useSessions();
  const { state, dispatch } = useApp();

  const handleChange = (promptId: string) => {
    const nextPromptId = promptId || null;
    if (!activeSession) {
      dispatch({ type: "SET_DRAFT_PROMPT", payload: nextPromptId });
      return;
    }
    updateActiveSession({ ...activeSession, systemPromptId: nextPromptId });
  };

  return (
    <select
      value={(activeSession ? activeSession.systemPromptId : state.draftSystemPromptId) || ""}
      onChange={(e) => handleChange(e.target.value)}
      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-on-surface focus:border-cyan/50 focus:outline-none transition-colors"
    >
      <option value="">No system prompt</option>
      {prompts.map((p) => (
        <option key={p.id} value={p.id}>
          {p.title}
        </option>
      ))}
    </select>
  );
}
