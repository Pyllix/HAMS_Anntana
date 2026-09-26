const STORAGE_PREFIX = "hams.sessionDraft:";
const ACCOUNT_KEY = STORAGE_PREFIX + "account";
const TAB_KEY = STORAGE_PREFIX + "tab";
const DRAFT_PREFIX = STORAGE_PREFIX + "draft:";
const TAB_CHANNEL_NAME = "hams-session-draft-tabs";
const TAB_SIGNAL_KEY = STORAGE_PREFIX + "tab-signal";

let currentTabId = null;
let tabChannel = null;
let fallbackTabChannel = null;
let storageSignalWindow = null;
const claimResponders = new Map();

function getSessionStorage() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function createId() {
  return globalThis.crypto?.randomUUID?.() ??
    Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
}

function clearDraftRows(storage) {
  if (!storage) return;
  const keys = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(DRAFT_PREFIX)) keys.push(key);
  }
  keys.forEach((key) => storage.removeItem(key));
}

function handleTabMessage(message) {
  if (message?.type === "CLAIM_TAB" && message.tabId === currentTabId) {
    postTabMessage({
      type: "TAB_IN_USE",
      requestId: message.requestId,
    });
  }
  if (message?.type === "TAB_IN_USE") {
    claimResponders.get(message.requestId)?.();
  }
}

function postTabMessage(message) {
  getTabChannel()?.postMessage(message);
}

function getTabChannel() {
  if (typeof window === "undefined" || !window.document) return null;
  if (typeof BroadcastChannel !== "undefined") {
    if (!tabChannel) {
      tabChannel = new BroadcastChannel(TAB_CHANNEL_NAME);
      tabChannel.onmessage = (event) => handleTabMessage(event.data);
    }
    return tabChannel;
  }

  if (typeof window.addEventListener !== "function") return null;
  try {
    const localStorage = window.localStorage;
    if (!localStorage) return null;
    if (storageSignalWindow !== window) {
      storageSignalWindow = window;
      window.addEventListener("storage", (event) => {
        if (event.key !== TAB_SIGNAL_KEY || !event.newValue) return;
        try {
          handleTabMessage(JSON.parse(event.newValue));
        } catch {
          // Ignore unrelated or malformed storage events.
        }
      });
    }
    if (!fallbackTabChannel) {
      fallbackTabChannel = {
        postMessage(message) {
          try {
            const envelope = { ...message, nonce: createId() };
            localStorage.setItem(TAB_SIGNAL_KEY, JSON.stringify(envelope));
            localStorage.removeItem(TAB_SIGNAL_KEY);
          } catch {
            // Draft isolation remains best-effort when storage is blocked.
          }
        },
      };
    }
    return fallbackTabChannel;
  } catch {
    return null;
  }
}
export async function initializeSessionDraftTab() {
  const storage = getSessionStorage();
  if (!storage) return;

  const bus = getTabChannel();
  const newTabId = createId();
  const previousTabId = storage.getItem(TAB_KEY);
  if (!previousTabId) {
    currentTabId = newTabId;
    storage.setItem(TAB_KEY, newTabId);
    return;
  }

  currentTabId = previousTabId;
  if (bus) {
    const requestId = createId();
    const clonedFromAnotherOpenTab = await new Promise((resolve) => {
      let settled = false;
      const finish = (claimed) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        claimResponders.delete(requestId);
        resolve(claimed);
      };
      const timeout = setTimeout(() => finish(false), 80);
      claimResponders.set(requestId, () => finish(true));
      bus.postMessage({
        type: "CLAIM_TAB",
        tabId: previousTabId,
        requestId,
      });
    });

    if (clonedFromAnotherOpenTab) clearDraftRows(storage);
  }

  currentTabId = newTabId;
  storage.setItem(TAB_KEY, newTabId);
}

export function associateSessionDraftAccount(userId) {
  if (!userId) return false;

  const storage = getSessionStorage();
  if (!storage) return false;
  const previousUserId = storage.getItem(ACCOUNT_KEY);
  if (!previousUserId || previousUserId !== userId) clearDraftRows(storage);
  storage.setItem(ACCOUNT_KEY, userId);
  return Boolean(previousUserId && previousUserId !== userId);
}

export function getCurrentSessionDraftAccountId() {
  return getSessionStorage()?.getItem(ACCOUNT_KEY) ?? null;
}
export function hasSessionDraftAccountChanged(currentUserId, nextUserId) {
  const currentAccountId = currentUserId ?? getCurrentSessionDraftAccountId();
  return Boolean(
    currentAccountId &&
      nextUserId &&
      currentAccountId !== nextUserId,
  );
}

export function getAccountStorageKey(baseKey) {
  const accountId = getCurrentSessionDraftAccountId();
  return accountId ? baseKey + ":" + encodeURIComponent(accountId) : null;
}

function storageKey(key) {
  return DRAFT_PREFIX + encodeURIComponent(key);
}

export function loadSessionDraft(key, userId) {
  const storage = getSessionStorage();
  if (!storage || !userId || storage.getItem(ACCOUNT_KEY) !== userId) return null;

  const keyName = storageKey(key);
  try {
    const saved = storage.getItem(keyName);
    if (!saved) return null;
    const envelope = JSON.parse(saved);
    if (
      envelope?.version !== 1 ||
      envelope.userId !== userId ||
      !Object.hasOwn(envelope, "data")
    ) {
      storage.removeItem(keyName);
      return null;
    }
    return envelope.data;
  } catch {
    storage.removeItem(keyName);
    return null;
  }
}

export function saveSessionDraft(key, userId, data) {
  const storage = getSessionStorage();
  if (!storage || !userId || storage.getItem(ACCOUNT_KEY) !== userId) return;
  try {
    storage.setItem(
      storageKey(key),
      JSON.stringify({
        version: 1,
        userId,
        savedAt: new Date().toISOString(),
        data,
      }),
    );
  } catch {
    // Quota errors must not interrupt the form the user is editing.
  }
}

export function clearSessionDraft(key) {
  getSessionStorage()?.removeItem(storageKey(key));
}

export function clearSessionDrafts() {
  const storage = getSessionStorage();
  clearDraftRows(storage);
  storage?.removeItem(ACCOUNT_KEY);
}

export function hasSessionDrafts(userId) {
  const storage = getSessionStorage();
  if (!storage || !userId || storage.getItem(ACCOUNT_KEY) !== userId) {
    return false;
  }
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key?.startsWith(DRAFT_PREFIX)) continue;
    try {
      const envelope = JSON.parse(storage.getItem(key) ?? "null");
      if (envelope?.version === 1 && envelope.userId === userId) return true;
    } catch {
      storage.removeItem(key);
    }
  }
  return false;
}