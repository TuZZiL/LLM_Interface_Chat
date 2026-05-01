import { usePrompts } from "../../hooks/usePrompts";
import { useSessions } from "../../hooks/useSessions";

export function PromptSelect() {
  const { prompts } = usePrompts();
  const { activeSession, updateActiveSession } = useSessions();

  const handleChange = (promptId: string) => {
    if (!activeSession) return;
    updateActiveSession({ ...activeSession, systemPromptId: promptId || null });
  };

  return (
    <select
      value={activeSession?.systemPromptId || ""}
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
