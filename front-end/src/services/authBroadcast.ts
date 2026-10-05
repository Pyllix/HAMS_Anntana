export type AuthBroadcastMessage =
  | { type: "SESSION_EXPIRED" }
  | { type: "SIGNED_OUT" }
  | { type: "ACCOUNT_CHANGED"; userId: string };

export function shouldInvalidateAccountBoundState(
  message: AuthBroadcastMessage,
  accountId: string | null,
): boolean {
  return message.type === "SIGNED_OUT" ||
    message.type === "SESSION_EXPIRED" ||
    (message.type === "ACCOUNT_CHANGED" && message.userId !== accountId);
}

const CHANNEL_NAME = "hams-auth-session";
const listeners = new Set<(message: AuthBroadcastMessage) => void>();
let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return null;
  }
  if (!channel) {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent<AuthBroadcastMessage>) => {
      listeners.forEach((listener) => listener(event.data));
    };
  }
  return channel;
}

export function publishAuthMessage(message: AuthBroadcastMessage): void {
  getChannel()?.postMessage(message);
}

export function subscribeAuthMessages(
  listener: (message: AuthBroadcastMessage) => void,
): () => void {
  getChannel();
  listeners.add(listener);
  return () => listeners.delete(listener);
}
