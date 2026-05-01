import { useSessions } from "../../hooks/useSessions";
import { useApp } from "../../context/AppContext";
import { Button } from "../ui/Button";

interface Props {
  open: boolean;
  onClose: () => void;
  side: "sessions" | "inspector";
  children?: React.ReactNode;
}

export function MobileDrawer({ open, onClose, side, children }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] md:hidden">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        className={`absolute top-0 h-full w-72 bg-[#0a0a0b] border-white/5 flex flex-col ${
          side === "sessions"
            ? "left-0 border-r"
            : "right-0 border-l"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

export function MobileSidebarContent({ onClose }: { onClose: () => void }) {
  const { sessions, activeSessionId, selectSession, addSession, removeSession } =
    useSessions();
  const { state } = useApp();

  const handleNew = async () => {
    const defaultModel = state.models[0]?.id || "mimo-v2.5-pro";
    const defaultPrompt = state.prompts.find((p) => p.isDefault)?.id;
    await addSession(defaultModel, defaultPrompt);
    onClose();
  };

  const handleSelect = (id: string) => {
    selectSession(id);
    onClose();
  };

  return (
    <>
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <div className="text-cyan font-bold text-label font-mono uppercase">
          Sessions
        </div>
        <button
          onClick={onClose}
          className="text-outline hover:text-on-surface text-lg"
        >
          ✕
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {sessions.length === 0 && (
          <div className="px-4 py-8 text-center text-outline text-xs">
            No sessions yet
          </div>
        )}
        {sessions.map((s) => (
          <div
            key={s.id}
            onClick={() => handleSelect(s.id)}
            className={`group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
              s.id === activeSessionId
                ? "bg-cyan/5 text-cyan"
                : "text-on-surface-variant hover:bg-white/5"
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
    </>
  );
}
