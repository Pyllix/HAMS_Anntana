import { useEffect, useRef, useState } from "react";
import {
  clearSessionDraft,
  loadSessionDraft,
  saveSessionDraft,
} from "../services/sessionDraftStorage";

interface UseSessionDraftOptions<T> {
  key: string;
  accountId?: string | null;
  enabled: boolean;
  value: T;
  restore: (draft: T) => void;
  isEmpty: (value: T) => boolean;
}

export function useSessionDraft<T>({
  key,
  accountId,
  enabled,
  value,
  restore,
  isEmpty,
}: UseSessionDraftOptions<T>): void {
  const [readyIdentity, setReadyIdentity] = useState("");
  const restoreRef = useRef(restore);
  const emptyRef = useRef(isEmpty);
  restoreRef.current = restore;
  emptyRef.current = isEmpty;

  const identity =
    enabled && accountId ? accountId + String.fromCharCode(31) + key : "";

  useEffect(() => {
    if (!identity || !accountId) {
      setReadyIdentity("");
      return;
    }

    const savedDraft = loadSessionDraft<T>(key, accountId);
    if (savedDraft !== null) restoreRef.current(savedDraft);
    setReadyIdentity(identity);
  }, [accountId, identity, key]);

  useEffect(() => {
    if (!identity || !accountId || readyIdentity !== identity) return;
    if (emptyRef.current(value)) {
      clearSessionDraft(key);
      return;
    }
    saveSessionDraft(key, accountId, value);
  }, [accountId, identity, key, readyIdentity, value]);
}