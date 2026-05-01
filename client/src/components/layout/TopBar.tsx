import { useApp } from "../../context/AppContext";
import { ApiStatusBadge } from "./ApiStatusBadge";

interface Props {
  onMenuClick?: () => void;
  onInspectorClick?: () => void;
}

export function TopBar({ onMenuClick, onInspectorClick }: Props) {
  const { state } = useApp();
  const activeModel = state.models.find(
    (m) => m.id === state.activeSession?.model
  );

  return (
    <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-4 md:px-6 h-14 bg-black/60 backdrop-blur-md border-b border-white/10">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="md:hidden text-outline hover:text-on-surface p-1"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M3 12h18M3 6h18M3 18h18" />
          </svg>
        </button>
        <span className="text-lg font-bold tracking-tighter text-white font-headline">
          MiMo Chat
        </span>
        {state.activeSession && (
          <span className="text-xs text-outline truncate max-w-[200px] hidden md:block">
            {state.activeSession.title}
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        {activeModel && (
          <span className="text-[10px] font-mono text-cyan border border-cyan/20 px-2 py-0.5 rounded-full uppercase hidden sm:inline">
            {activeModel.label}
          </span>
        )}
        <ApiStatusBadge />
        <button
          onClick={onInspectorClick}
          className="md:hidden text-outline hover:text-on-surface p-1"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
        </button>
      </div>
    </header>
  );
}
