import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthStore } from "../stores/authStore";
import {
  shouldInvalidateAccountBoundState,
  subscribeAuthMessages,
} from "../services/authBroadcast";
import {
  uploadAndVerifyImage,
  type ImagePurpose,
  type ImageUploadStage,
  type VerifiedImageUpload,
} from "../services/imageUploadService";

export type ImageSelectionStatus = "idle" | ImageUploadStage | "ready" | "error";

export interface ImageSelectionState {
  status: ImageSelectionStatus;
  upload: VerifiedImageUpload | null;
  previewUrl: string | null;
  fileName: string;
  error: string;
  accountId: string | null;
}

function emptySelection(accountId: string | null): ImageSelectionState {
  return {
    status: "idle",
    upload: null,
    previewUrl: null,
    fileName: "",
    error: "",
    accountId,
  };
}

export function useImageUploadSelection(options: {
  purpose: ImagePurpose;
  targetId?: string;
  enabled: boolean;
}) {
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  const [storedState, setStoredState] = useState(() => emptySelection(accountId));
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const objectUrl = useRef<string | null>(null);
  const enabledRef = useRef(options.enabled);
  const accountIdRef = useRef(accountId);
  enabledRef.current = options.enabled;
  accountIdRef.current = accountId;

  const releaseObjectUrl = useCallback(() => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
  }, []);

  const abortCurrent = useCallback(() => {
    generation.current += 1;
    controller.current?.abort();
    controller.current = null;
    releaseObjectUrl();
  }, [releaseObjectUrl]);

  const clearSelection = useCallback(() => {
    abortCurrent();
    setStoredState(emptySelection(accountIdRef.current));
  }, [abortCurrent]);

  const markSelectionError = useCallback((message: string) => {
    abortCurrent();
    setStoredState({
      ...emptySelection(accountIdRef.current),
      status: "error",
      error: message,
    });
  }, [abortCurrent]);

  const selectFile = useCallback(async (file: File) => {
    if (!enabledRef.current || !accountIdRef.current) return;
    abortCurrent();
    const currentGeneration = generation.current;
    const currentAccountId = accountIdRef.current;
    const requestController = new AbortController();
    controller.current = requestController;
    setStoredState({
      ...emptySelection(currentAccountId),
      status: "uploading",
      fileName: file.name,
    });

    const isCurrent = () =>
      generation.current === currentGeneration &&
      !requestController.signal.aborted &&
      enabledRef.current &&
      accountIdRef.current === currentAccountId &&
      useAuthStore.getState().user?.id === currentAccountId;

    try {
      const upload = await uploadAndVerifyImage(
        file,
        options.purpose,
        options.targetId,
        {
          signal: requestController.signal,
          onStage: (stage) => {
            if (isCurrent()) {
              setStoredState((state) => ({ ...state, status: stage }));
            }
          },
        },
      );
      if (!isCurrent()) return;

      const previewUrl = upload.previewBlob
        ? URL.createObjectURL(upload.previewBlob)
        : upload.previewUrl;
      if (upload.previewBlob) objectUrl.current = previewUrl;
      setStoredState({
        status: "ready",
        upload,
        previewUrl,
        fileName: file.name,
        error: "",
        accountId: currentAccountId,
      });
    } catch (error) {
      if (!isCurrent()) return;
      const message = error instanceof Error
        ? error.message
        : "อัปโหลดหรือตรวจสอบรูปไม่สำเร็จ กรุณาลองใหม่";
      setStoredState({
        ...emptySelection(currentAccountId),
        status: "error",
        fileName: file.name,
        error: message,
      });
    } finally {
      if (controller.current === requestController) controller.current = null;
    }
  }, [abortCurrent, options.purpose, options.targetId]);

  useEffect(() => {
    clearSelection();
    return abortCurrent;
  }, [accountId, options.enabled, options.purpose, options.targetId, abortCurrent, clearSelection]);

  useEffect(() => subscribeAuthMessages((message) => {
    if (shouldInvalidateAccountBoundState(message, accountIdRef.current)) {
      clearSelection();
    }
  }), [clearSelection]);

  const state = storedState.accountId === accountId
    ? storedState
    : emptySelection(accountId);

  return { state, selectFile, clearSelection, markSelectionError };
}
