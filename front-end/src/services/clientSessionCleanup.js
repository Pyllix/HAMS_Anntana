/**
 * @param {import("@tanstack/react-query").QueryClient} queryClient
 * @param {{ clearDrafts?: boolean, broadcast?: import("./authBroadcast").AuthBroadcastMessage }} options
 * @param {{
 *   clearDrafts: () => void,
 *   logout: () => void,
 *   publish: (message: import("./authBroadcast").AuthBroadcastMessage) => void,
 *   redirectToLogin: () => void,
 * }} actions
 */
export function clearClientSessionState(queryClient, options = {}, actions) {
  if (options.clearDrafts) actions.clearDrafts();
  queryClient.clear();
  actions.logout();
  if (options.broadcast) actions.publish(options.broadcast);
  actions.redirectToLogin();
}