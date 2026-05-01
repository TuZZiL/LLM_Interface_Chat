import { useState, useRef, useCallback } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { useUpload } from "../../hooks/useUpload";
import { useChat } from "../../hooks/useChat";
import { useSessions } from "../../hooks/useSessions";
import { useApp } from "../../context/AppContext";
import { ImagePreview } from "./ImagePreview";
import type { Attachment } from "../../types";

export function Composer() {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const { upload, uploading } = useUpload();
  const { sendMessage, chatStatus } = useChat();
  const { activeSession, updateActiveSession } = useSessions();
  const { state } = useApp();

  const loading = chatStatus === "sending" || chatStatus === "streaming";

  const handleAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const att = await upload(file);
    if (att) {
      setAttachments((prev) => [...prev, att]);
      // Auto-switch to image model if current doesn't support images
      if (activeSession) {
        const currentModel = state.models.find(
          (m) => m.id === activeSession.model
        );
        if (currentModel && !currentModel.supportsImages) {
          const imageModel = state.models.find((m) => m.supportsImages);
          if (imageModel) {
            updateActiveSession({
              ...activeSession,
              model: imageModel.id,
            });
          }
        }
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSend = useCallback(async () => {
    if (!activeSession) return;
    if (!text.trim() && attachments.length === 0) return;

    const textToSend = text.trim();
    const attToSend = [...attachments];

    // Clear input immediately
    setText("");
    setAttachments([]);

    await sendMessage({
      sessionId: activeSession.id,
      model: activeSession.model,
      systemPromptId: activeSession.systemPromptId || undefined,
      text: textToSend,
      attachments: attToSend.length > 0 ? attToSend : undefined,
      params: state.chatParams,
    });
  }, [
    activeSession,
    text,
    attachments,
    sendMessage,
    state.chatParams,
  ]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const disabled = loading || uploading || !activeSession;
  const hasImages = attachments.length > 0;

  return (
    <div className="px-6 pb-4 pt-2">
      <div className="max-w-[800px] mx-auto">
        {hasImages && (
          <div className="flex items-center gap-2 mb-2">
            <div className="flex gap-2 flex-wrap flex-1">
              {attachments.map((a) => (
                <ImagePreview
                  key={a.id}
                  attachment={a}
                  onRemove={() => handleRemoveAttachment(a.id)}
                />
              ))}
            </div>
            <span className="text-[10px] text-cyan font-mono uppercase">
              Image mode: MiMo-V2.5
            </span>
          </div>
        )}
        <div className="glass-panel border border-white/10 rounded-2xl p-2 flex items-center gap-2 focus-within:border-cyan/35 focus-within:shadow-[0_0_12px_rgba(0,219,233,0.1)] transition-all">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,image/bmp"
            onChange={handleAttach}
            className="hidden"
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={disabled}
            className="h-10 w-10 flex items-center justify-center text-outline hover:text-cyan transition-colors disabled:opacity-30 shrink-0"
            title="Attach image"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
          <TextareaAutosize
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={
              activeSession ? "Type a message..." : "Select a session first"
            }
            minRows={1}
            maxRows={6}
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-body text-on-surface placeholder:text-outline-variant resize-none py-2 px-1 outline-none"
          />
          <button
            onClick={handleSend}
            disabled={disabled || (!text.trim() && !hasImages)}
            className="h-10 w-10 shrink-0 rounded-xl bg-black border border-cyan/50 text-cyan hover:bg-cyan/10 transition-all cyan-bloom-sm disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
            title="Send"
          >
            {loading ? (
              <span className="animate-pulse text-xs">...</span>
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
