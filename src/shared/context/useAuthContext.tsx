import { useContext } from "react";
import { AuthContext } from "./auth.context";

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("AuthProvider가 설정되지 않았습니다.");
  }
  return ctx;
}
