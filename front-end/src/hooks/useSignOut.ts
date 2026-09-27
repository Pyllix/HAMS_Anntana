import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../stores/authStore";
import { clearSessionDrafts } from "../services/sessionDraftStorage";
import { publishAuthMessage } from "../services/authBroadcast";
import { revokeCurrentSession } from "../services/authService";
import { revokeBeforeClearingSession } from "../services/signOutFlow.js";

export default function useSignOut() {
  const queryClient = useQueryClient();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");

  const signOut = useCallback(async () => {
    setIsSigningOut(true);
    setSignOutError("");
    try {
      await revokeBeforeClearingSession(revokeCurrentSession, () => {
        clearSessionDrafts();
        queryClient.clear();
        useAuthStore.getState().logout();
        publishAuthMessage({ type: "SIGNED_OUT" });
      });
      window.location.replace("/login");
    } catch {
      setSignOutError("ออกจากระบบไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setIsSigningOut(false);
    }
  }, [queryClient]);

  return { signOut, isSigningOut, signOutError };
}
