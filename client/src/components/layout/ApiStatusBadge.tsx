import { useEffect, useState } from "react";
import { useApp } from "../../context/AppContext";

interface ProviderHealth {
  apiKeyConfigured: boolean;
  baseUrl: string;
}

interface HealthData {
  ok: boolean;
  providers: {
    mimo: ProviderHealth;
    deepseek: ProviderHealth;
  };
}

export function ApiStatusBadge() {
  const { state } = useApp();
  const [health, setHealth] = useState<HealthData | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  const activeModel = state.activeSession?.model;
  const activeModelConfig = state.models.find((m) => m.id === activeModel);
  const provider = activeModelConfig?.provider || "mimo";

  const providerOk = health
    ? health.providers?.[provider]?.apiKeyConfigured ?? false
    : false;

  const status = !health
    ? { label: "Checking...", color: "bg-outline" }
    : !providerOk
      ? { label: `No ${provider} key`, color: "bg-error" }
      : state.chatStatus === "sending" || state.chatStatus === "streaming"
        ? { label: "Active", color: "bg-cyan animate-pulse" }
        : state.chatStatus === "error"
          ? { label: "Error", color: "bg-error" }
          : { label: "Ready", color: "bg-secondary" };

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${status.color}`} />
      <span className="text-[10px] font-mono text-outline uppercase hidden sm:inline">
        {status.label}
      </span>
      {state.lastLatencyMs !== null && (
        <span className="text-[10px] font-mono text-outline-variant hidden sm:inline">
          {(state.lastLatencyMs / 1000).toFixed(1)}s
        </span>
      )}
    </div>
  );
}
