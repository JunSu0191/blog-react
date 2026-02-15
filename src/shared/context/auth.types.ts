import type { AuthResponse } from "@/features/user/api";

export interface User {
  id: number;
  username: string;
  name: string;
}

export type AuthContextValue = {
  token: string | null;
  user: User | null;
  login: (username: string, password: string) => Promise<AuthResponse>;
  register: (
    username: string,
    name: string,
    password: string
  ) => Promise<AuthResponse>;
  logout: () => void;
};
