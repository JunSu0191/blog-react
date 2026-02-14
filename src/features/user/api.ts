import { api, API_BASE_URL } from "../../shared/lib/api";
import { setRefreshToken, setToken, setUserId } from "../../shared/lib/auth";

const BASE = API_BASE_URL;

export type LoginRequest = {
  username: string;
  password: string;
};

export type RegisterRequest = {
  username: string;
  password: string;
  name: string;
};

export type AuthResponse = {
  token: string;
  refreshToken?: string;
  userId?: number;
};

export async function login(req: LoginRequest): Promise<AuthResponse> {
  try {
    const data = await api<AuthResponse>(`${BASE}/auth/login`, {
      method: "POST",
      data: req,
    });
    console.log("Login response:", data);

    if (data?.token) setToken(data.token);
    if (data?.refreshToken) setRefreshToken(data.refreshToken);
    if (typeof data?.userId === "number") setUserId(data.userId);
    return data;
  } catch (err: any) {
    const serverMsg = err?.response?.data?.message || "로그인에 실패했습니다";
    throw new Error(serverMsg);
  }
}

export async function register(req: RegisterRequest): Promise<AuthResponse> {
  try {
    const data = await api<AuthResponse>(`${BASE}/auth/register`, {
      method: "POST",
      data: req,
    });
    if (data?.token) setToken(data.token);
    if (data?.refreshToken) setRefreshToken(data.refreshToken);
    if (typeof data?.userId === "number") setUserId(data.userId);
    return data;
  } catch (err: any) {
    const serverMsg = err?.response?.data?.message || "회원가입에 실패했습니다";
    throw new Error(serverMsg);
  }
}
