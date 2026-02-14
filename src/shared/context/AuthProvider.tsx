import React from "react";
import { useAuth } from "../hooks/useAuth";
import { AuthContext } from "./auth.context";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthProvider;
