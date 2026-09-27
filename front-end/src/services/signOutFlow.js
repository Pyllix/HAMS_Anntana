export async function revokeBeforeClearingSession(revokeServerSession, clearClientSession) {
  await revokeServerSession();
  clearClientSession();
}
