export async function restoreServerSession(readSession, loadUser) {
  const response = await readSession();
  const { session, user: sessionUser } = response.data;

  if (!session || !sessionUser?.id || session.userId !== sessionUser.id) {
    return null;
  }

  const user = await loadUser(session.userId);
  if (!user?.id || user.id !== session.userId) return null;

  return { user, session };
}
