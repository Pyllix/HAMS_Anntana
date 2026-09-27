interface SessionUser {
  id: string;
}

interface SessionWithUserId {
  userId: string;
}

export async function restoreServerSession<
  TUser extends SessionUser,
  TSession extends SessionWithUserId,
>(
  readSession: () => Promise<{
    data: { session?: TSession | null; user?: SessionUser | null };
  }>,
  loadUser: (userId: string) => Promise<TUser | null>,
): Promise<{ user: TUser; session: TSession } | null> {
  const response = await readSession();
  const { session, user: sessionUser } = response.data;

  if (!session || !sessionUser?.id || session.userId !== sessionUser.id) {
    return null;
  }

  const user = await loadUser(session.userId);
  if (!user?.id || user.id !== session.userId) return null;

  return { user, session };
}
