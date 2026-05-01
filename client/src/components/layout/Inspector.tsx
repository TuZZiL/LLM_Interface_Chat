import { useApp } from "../../context/AppContext";
import { usePrompts } from "../../hooks/usePrompts";
import { useSessions } from "../../hooks/useSessions";
import { PromptSelect } from "../prompts/PromptSelect";
import { useState } from "react";
import { PromptModal } from "../prompts/PromptModal";

export function InspectorContent() {
  const { state, dispatch } = useApp();
  const { activeSession, updateActiveSession } = useSessions();
  const { prompts } = usePrompts();
  const [promptModalOpen, setPromptModalOpen] = useState(false);

  if (!activeSession) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-outline text-xs text-center px-4">
          Select a session to see details
        </div>
      </div>
    );
  }

  const currentPrompt = prompts.find(
    (p) => p.id === activeSession.systemPromptId
  );

  const handleModelChange = (modelId: string) => {
    updateActiveSession({ ...activeSession, model: modelId });
  };

  const usage = activeSession.messages
    .filter((m) => m.usage)
    .reduce(
      (acc, m) => {
        const u = m.usage!;
        return {
          prompt: acc.prompt + u.prompt_tokens,
          completion: acc.completion + u.completion_tokens,
          total: acc.total + u.total_tokens,
        };
      },
      { prompt: 0, completion: 0, total: 0 }
    );

  return (
    <>
      <div className="p-4 space-y-6">
        {/* Model Select */}
        <section>
          <div className="text-cyan text-label font-mono uppercase mb-3 border-l-2 border-cyan pl-2">
            Model
          </div>
          <div className="space-y-1">
            {state.models.map((m) => (
              <button
                key={m.id}
                onClick={() => handleModelChange(m.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                  activeSession.model === m.id
                    ? "bg-cyan/10 text-cyan border border-cyan/30"
                    : "text-on-surface-variant hover:bg-white/5 border border-transparent"
                }`}
              >
                <div className="font-medium">{m.label}</div>
                <div className="text-outline text-[10px] mt-0.5">
                  {m.supportsImages ? "Text + Image" : "Text only"}
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Prompt Select */}
        <section>
          <div className="flex items-center justify-between text-cyan text-label font-mono uppercase mb-3 border-l-2 border-cyan pl-2">
            <span>Prompt</span>
            <button
              onClick={() => setPromptModalOpen(true)}
              className="text-[10px] text-outline hover:text-cyan transition-colors"
            >
              EDIT
            </button>
          </div>
          <PromptSelect />
          {currentPrompt && (
            <div className="mt-2 p-2 rounded bg-black/30 border border-white/5 text-xs text-outline line-clamp-3">
              {currentPrompt.content}
            </div>
          )}
        </section>

        {/* Parameters */}
        <section>
          <div className="text-cyan text-label font-mono uppercase mb-3 border-l-2 border-cyan pl-2">
            Parameters
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-[10px] uppercase text-outline mb-1">
                <span>Temperature</span>
                <span className="text-on-surface font-mono">
                  {state.chatParams.temperature.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1.5"
                step="0.05"
                value={state.chatParams.temperature}
                onChange={(e) =>
                  dispatch({
                    type: "SET_PARAMS",
                    payload: { temperature: parseFloat(e.target.value) },
                  })
                }
                className="w-full h-1 bg-surface-container-highest rounded-full appearance-none cursor-pointer accent-cyan"
              />
              <div className="flex justify-between text-[9px] text-outline-variant mt-0.5">
                <span>Precise</span>
                <span>Creative</span>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[10px] uppercase text-outline mb-1">
                <span>Top P</span>
                <span className="text-on-surface font-mono">
                  {state.chatParams.top_p.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0.01"
                max="1"
                step="0.01"
                value={state.chatParams.top_p}
                onChange={(e) =>
                  dispatch({
                    type: "SET_PARAMS",
                    payload: { top_p: parseFloat(e.target.value) },
                  })
                }
                className="w-full h-1 bg-surface-container-highest rounded-full appearance-none cursor-pointer accent-cyan"
              />
              <div className="flex justify-between text-[9px] text-outline-variant mt-0.5">
                <span>Focused</span>
                <span>Diverse</span>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[10px] uppercase text-outline mb-1">
                <span>Max Tokens</span>
                <span className="text-on-surface font-mono">
                  {state.chatParams.max_completion_tokens ?? "auto"}
                </span>
              </div>
              <input
                type="range"
                min="256"
                max="131072"
                step="256"
                value={state.chatParams.max_completion_tokens ?? 131072}
                onChange={(e) =>
                  dispatch({
                    type: "SET_PARAMS",
                    payload: {
                      max_completion_tokens: parseInt(e.target.value),
                    },
                  })
                }
                className="w-full h-1 bg-surface-container-highest rounded-full appearance-none cursor-pointer accent-cyan"
              />
              <div className="flex justify-between text-[9px] text-outline-variant mt-0.5">
                <span>256</span>
                <span>131072</span>
              </div>
            </div>
          </div>
        </section>

        {/* Usage */}
        {usage.total > 0 && (
          <section>
            <div className="text-cyan text-label font-mono uppercase mb-3 border-l-2 border-cyan pl-2">
              Usage
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-on-surface-variant">
                <span>Prompt tokens</span>
                <span className="text-on-surface font-mono">
                  {usage.prompt.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-on-surface-variant">
                <span>Completion tokens</span>
                <span className="text-on-surface font-mono">
                  {usage.completion.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-on-surface-variant border-t border-white/5 pt-2">
                <span>Total</span>
                <span className="text-cyan font-mono font-bold">
                  {usage.total.toLocaleString()}
                </span>
              </div>
            </div>
          </section>
        )}
      </div>

      <PromptModal
        open={promptModalOpen}
        onClose={() => setPromptModalOpen(false)}
        editId={currentPrompt?.id}
      />
    </>
  );
}

export function Inspector() {
  return (
    <aside className="fixed right-0 top-14 h-[calc(100vh-56px)] w-72 bg-surface-container-lowest/80 backdrop-blur-xl border-l border-white/5 hidden md:flex flex-col z-40 overflow-y-auto">
      <div className="p-4 border-b border-white/5">
        <div className="text-white font-bold text-label font-mono uppercase">
          Inspector
        </div>
      </div>
      <InspectorContent />
    </aside>
  );
}
