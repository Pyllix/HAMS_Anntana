export async function revokeBeforeClearingSession(
  revokeServerSession: () => Promise<unknown>,
  clearClientSession: () => void,
): Promise<void> {
  await revokeServerSession();
  clearClientSession();
}
