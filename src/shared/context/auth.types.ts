import type { AuthResponse } from "@/features/user/api";

export type UserRole = "USER" | "ADMIN";
export type UserStatus = "ACTIVE" | "SUSPENDED";

export interface User {
  id: number;
  username: string;
  name: string;
  nickname?: string;
  displayName?: string;
  email?: string;
  authProvider?: string;
  signupCompleted?: boolean;
  needsProfileSetup?: boolean;
  role?: UserRole;
  status?: UserStatus;
  mustChangePassword?: boolean;
}

export type AuthContextValue = {
  token: string | null;
  user: User | null;
  isLoadingUser: boolean;
  login: (username: string, password: string) => Promise<AuthResponse>;
  loginWithToken: (token: string) => Promise<User>;
  refreshUser: () => Promise<User | null>;
  register: (
    username: string,
    name: string,
    password: string
  ) => Promise<AuthResponse>;
  logout: () => void;
};
