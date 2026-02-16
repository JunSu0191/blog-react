import type { AuthResponse } from "@/features/user/api";

export type UserRole = "USER" | "ADMIN";
export type UserStatus = "ACTIVE" | "SUSPENDED";

export interface User {
  id: number;
  username: string;
  name: string;
  role?: UserRole;
  status?: UserStatus;
  mustChangePassword?: boolean;
}

export type AuthContextValue = {
  token: string | null;
  user: User | null;
  isLoadingUser: boolean;
  login: (username: string, password: string) => Promise<AuthResponse>;
  register: (
    username: string,
    name: string,
    password: string
  ) => Promise<AuthResponse>;
  logout: () => void;
};
