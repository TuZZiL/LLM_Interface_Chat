import { useSessions } from "../../hooks/useSessions";
import { useApp } from "../../context/AppContext";
import { Button } from "../ui/Button";

export function Sidebar() {
  const { sessions, activeSessionId, selectSession, addSession, removeSession } =
    useSessions();
  const { state } = useApp();

  const handleNew = async () => {
    const defaultModel = state.models[0]?.id || "mimo-v2.5-pro";
    const defaultPrompt = state.prompts.find((p) => p.isDefault)?.id;
    await addSession(defaultModel, defaultPrompt);
  };

  return (
    <aside className="fixed left-0 top-14 h-[calc(100vh-56px)] w-60 bg-[#050505] border-r border-white/5 hidden md:flex flex-col z-40">
      <div className="p-4">
        <div className="text-cyan font-bold text-label font-mono uppercase">
          Sessions
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 space-y-0.5">
        {sessions.length === 0 && (
          <div className="px-4 py-8 text-center text-outline text-xs">
            No sessions yet
          </div>
        )}
        {sessions.map((s) => (
          <div
            key={s.id}
            onClick={() => selectSession(s.id)}
            className={`group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
              s.id === activeSessionId
                ? "bg-cyan/5 border-r-2 border-cyan text-cyan"
                : "text-on-surface-variant hover:bg-white/5 hover:text-on-surface"
            }`}
          >
            <span className="text-xs truncate">{s.title}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeSession(s.id);
              }}
              className="opacity-0 group-hover:opacity-100 text-outline hover:text-error transition-opacity text-xs"
            >
              ✕
            </button>
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-white/5">
        <Button variant="ghost" size="sm" className="w-full" onClick={handleNew}>
          + New Chat
        </Button>
      </div>
    </aside>
  );
}
