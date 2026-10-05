import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "../stores/authStore";
import {
  clearEmployeePhotoGrantCache,
  getEmployeePhotoBlob,
} from "../services/imageUploadService";
import {
  shouldInvalidateAccountBoundState,
  subscribeAuthMessages,
} from "../services/authBroadcast";

export type EmployeePhotoState =
  | { key: string; status: "idle" | "loading" | "missing" }
  | { key: string; status: "ready"; objectUrl: string }
  | { key: string; status: "error"; message: string };

export function useEmployeePhoto(
  userId: string,
  hasEmployeePhoto: boolean | undefined,
  photoRevision: string | null | undefined,
  enabled: boolean,
): EmployeePhotoState {
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  const key = `${accountId ?? "signed-out"}:${userId}:${photoRevision ?? "unversioned"}`;
  const controllerRef = useRef<AbortController | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const previousPhotoRef = useRef<{
    accountId: string | null;
    userId: string;
    photoRevision: string | null | undefined;
    hasEmployeePhoto: boolean | undefined;
  } | null>(null);
  const [storedState, setStoredState] = useState<EmployeePhotoState>({
    key,
    status: "idle",
  });

  useEffect(() => {
    const previous = previousPhotoRef.current;
    if (
      previous &&
      (previous.accountId !== accountId ||
        previous.userId !== userId ||
        previous.photoRevision !== photoRevision ||
        previous.hasEmployeePhoto !== hasEmployeePhoto)
    ) {
      clearEmployeePhotoGrantCache(previous.accountId, previous.userId);
    }
    previousPhotoRef.current = {
      accountId,
      userId,
      photoRevision,
      hasEmployeePhoto,
    };
  }, [accountId, hasEmployeePhoto, photoRevision, userId]);

  useEffect(() => {
    if (!enabled || !accountId || !userId) {
      setStoredState({ key, status: "idle" });
      return;
    }
    if (hasEmployeePhoto === false) {
      setStoredState({ key, status: "missing" });
      return;
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    let current = true;
    setStoredState({ key, status: "loading" });

    void (async () => {
      try {
        const blob = await getEmployeePhotoBlob(userId, {
          accountId,
          photoRevision,
          signal: controller.signal,
        });
        if (!current) return;
        if (!blob) {
          setStoredState({ key, status: "missing" });
          return;
        }
        const objectUrl = URL.createObjectURL(blob);
        objectUrlRef.current = objectUrl;
        setStoredState({ key, status: "ready", objectUrl });
      } catch (error: unknown) {
        if (!current || controller.signal.aborted) return;
        setStoredState({
          key,
          status: "error",
          message: error instanceof Error
            ? error.message
            : "โหลดรูปพนักงานไม่สำเร็จ กรุณาลองใหม่",
        });
      }
    })();

    return () => {
      current = false;
      controller.abort();
      if (controllerRef.current === controller) controllerRef.current = null;
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    };
  }, [accountId, enabled, hasEmployeePhoto, key, userId, photoRevision]);

  useEffect(() => subscribeAuthMessages((message) => {
    if (shouldInvalidateAccountBoundState(message, accountId)) {
      controllerRef.current?.abort();
      controllerRef.current = null;
      clearEmployeePhotoGrantCache();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
      setStoredState({ key, status: "idle" });
    }
  }), [accountId, key]);

  return storedState.key === key
    ? storedState
    : { key, status: enabled ? "loading" : "idle" };
}
