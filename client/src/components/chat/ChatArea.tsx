import { useRef, useEffect } from "react";
import { useApp } from "../../context/AppContext";
import { useChat } from "../../hooks/useChat";
import { EmptyState } from "./EmptyState";
import { MessageBubble } from "./MessageBubble";

export function ChatArea() {
  const { state } = useApp();
  const { regenerateMessage } = useChat();
  const endRef = useRef<HTMLDivElement>(null);
  const messages = state.activeSession?.messages || [];
  const isStreaming =
    state.chatStatus === "sending" || state.chatStatus === "streaming";

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isStreaming]);

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
      <div className="max-w-[800px] mx-auto space-y-4">
        {messages.length === 0 && !isStreaming && <EmptyState />}
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            onRegenerate={regenerateMessage}
            canRegenerate={!isStreaming}
          />
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
