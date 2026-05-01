import { useState, useCallback } from "react";
import * as api from "../api/client";
import type { Attachment } from "../types";

export function useUpload() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(async (file: File): Promise<Attachment | null> => {
    setUploading(true);
    setError(null);
    try {
      const att = await api.uploadImage(file);
      return att;
    } catch (e: unknown) {
      const msg =
        (e as { error?: { message?: string } })?.error?.message ||
        (e instanceof Error ? e.message : "Upload failed");
      setError(msg);
      return null;
    } finally {
      setUploading(false);
    }
  }, []);

  return { upload, uploading, error };
}
