export interface LogoutDependencies {
  clearServerSession: () => Promise<void>;
  signOutUser: () => Promise<void>;
  clearLegacyToken: () => void;
}

export async function completeLogout({
  clearServerSession,
  signOutUser,
  clearLegacyToken,
}: LogoutDependencies): Promise<void> {
  await clearServerSession();
  await signOutUser();
  clearLegacyToken();
}
