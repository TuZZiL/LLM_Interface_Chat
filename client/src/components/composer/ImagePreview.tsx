import type { Attachment } from "../../types";

interface Props {
  attachment: Attachment;
  onRemove: () => void;
}

export function ImagePreview({ attachment, onRemove }: Props) {
  if (!attachment.dataUrl) return null;

  return (
    <div className="relative group">
      <img
        src={attachment.dataUrl}
        alt={attachment.fileName}
        className="w-16 h-16 object-cover rounded-lg border border-white/10"
      />
      <button
        onClick={onRemove}
        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-error-container text-on-error-container rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      >
        ✕
      </button>
    </div>
  );
}
