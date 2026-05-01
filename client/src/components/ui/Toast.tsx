import { useEffect, useState } from "react";

interface Toast {
  id: number;
  type: "error" | "success";
  message: string;
}

let _addToast: ((t: Omit<Toast, "id">) => void) | null = null;

export function toast(message: string, type: "error" | "success" = "error") {
  _addToast?.({ message, type });
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    _addToast = (t) => {
      const id = Date.now();
      setToasts((prev) => [...prev, { ...t, id }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== id));
      }, 4000);
    };
    return () => {
      _addToast = null;
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[200] space-y-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`glass-panel border px-4 py-3 rounded-lg text-sm font-body max-w-sm ${
            t.type === "error"
              ? "border-error/30 text-error"
              : "border-secondary/30 text-secondary"
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
