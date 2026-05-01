import { useState, useEffect } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { usePrompts } from "../../hooks/usePrompts";
import { toast } from "../ui/Toast";

interface Props {
  open: boolean;
  onClose: () => void;
  editId?: string;
}

export function PromptModal({ open, onClose, editId }: Props) {
  const { prompts, addPrompt, editPrompt, removePrompt } = usePrompts();
  const [selectedId, setSelectedId] = useState<string | null>(editId ?? null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  const editing = selectedId ? prompts.find((p) => p.id === selectedId) : null;

  useEffect(() => {
    if (!open) return;
    setSelectedId(editId ?? prompts.find((p) => p.isDefault)?.id ?? prompts[0]?.id ?? null);
  }, [editId, open, prompts]);

  useEffect(() => {
    if (!open) return;
    if (!selectedId) {
      setTitle("");
      setContent("");
      setIsDefault(false);
      return;
    }
    const prompt = prompts.find((p) => p.id === selectedId);
    if (!prompt) return;
    setTitle(prompt.title);
    setContent(prompt.content);
    setIsDefault(prompt.isDefault);
  }, [selectedId, prompts, open]);

  const handleNew = () => {
    setSelectedId(null);
    setTitle("");
    setContent("");
    setIsDefault(false);
  };

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      toast("Title and content are required");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const saved = await editPrompt(editing.id, {
          title: title.trim(),
          content: content.trim(),
          isDefault: editing.isDefault ? true : isDefault,
        });
        setSelectedId(saved.id);
      } else {
        const created = await addPrompt({
          title: title.trim(),
          content: content.trim(),
          isDefault,
        });
        setSelectedId(created.id);
      }
      toast("Prompt saved");
    } catch {
      toast("Failed to save prompt");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    try {
      await removePrompt(editing.id);
      onClose();
    } catch {
      toast("Cannot delete the only prompt");
    }
  };

  const canDelete = Boolean(editing && prompts.length > 1);
  const defaultLocked = Boolean(editing?.isDefault);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Prompt Manager"
      size="lg"
    >
      <div className="grid gap-4 md:grid-cols-[260px_1fr]">
        <aside className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-label text-cyan font-mono uppercase">
              Prompts
            </div>
            <Button variant="ghost" size="sm" onClick={handleNew}>
              New
            </Button>
          </div>
          <div className="max-h-[56vh] overflow-y-auto space-y-1 pr-1">
            {prompts.map((prompt) => (
              <button
                key={prompt.id}
                onClick={() => setSelectedId(prompt.id)}
                className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${
                  selectedId === prompt.id
                    ? "border-cyan/40 bg-cyan/10 text-on-surface"
                    : "border-white/5 bg-black/20 text-on-surface-variant hover:border-white/15 hover:bg-white/5"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-xs font-medium">
                    {prompt.title}
                  </span>
                  {prompt.isDefault && (
                    <span className="rounded border border-cyan/30 px-1.5 py-0.5 text-[9px] font-mono uppercase text-cyan">
                      Default
                    </span>
                  )}
                </div>
                <div className="mt-1 line-clamp-2 text-[10px] leading-4 text-outline">
                  {prompt.content}
                </div>
              </button>
            ))}
          </div>
        </aside>

        <div className="space-y-4">
          <div>
            <label className="text-label text-on-surface-variant font-mono uppercase block mb-1">
              Title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-on-surface focus:border-cyan/50 focus:outline-none"
              placeholder="Prompt title"
            />
          </div>
          <div>
            <label className="text-label text-on-surface-variant font-mono uppercase block mb-1">
              Content
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-on-surface focus:border-cyan/50 focus:outline-none resize-y"
              style={{
                minHeight: "50vh",
                maxHeight: "65vh",
              }}
              placeholder="System prompt content..."
            />
          </div>
          <label
            className={`flex items-center gap-2 text-xs text-on-surface-variant ${
              defaultLocked ? "cursor-not-allowed opacity-75" : "cursor-pointer"
            }`}
          >
            <input
              type="checkbox"
              checked={isDefault}
              disabled={defaultLocked}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="accent-cyan"
            />
            Set as default for new chats
          </label>
          <div className="flex justify-between pt-2">
            <div>
              {editing && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleDelete}
                  disabled={!canDelete}
                >
                  Delete
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={onClose}>
                Close
              </Button>
              <Button variant="solid" size="sm" onClick={handleSave} disabled={saving}>
                {saving ? "Saving" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
