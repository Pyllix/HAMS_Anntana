export type AuthBroadcastMessage =
  | { type: "SESSION_EXPIRED" }
  | { type: "SIGNED_OUT" }
  | { type: "ACCOUNT_CHANGED"; userId: string };

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