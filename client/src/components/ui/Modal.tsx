import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  size?: "sm" | "lg";
  children: ReactNode;
}

export function Modal({ open, onClose, title, size = "sm", children }: Props) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const width = size === "lg" ? "min(920px, calc(100vw - 32px))" : "min(480px, calc(100vw - 32px))";

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass-panel border border-white/10 rounded-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        style={{ width }}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <h3 className="text-headline font-headline text-white">{title}</h3>
        )}
        {children}
      </div>
    </div>,
    document.body
  );
}
