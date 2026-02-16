import { useQuery } from "@tanstack/react-query";
import { useAuthContext } from "@/shared/context/useAuthContext";
import { getToken } from "@/shared/lib/auth";
import type { ApiError } from "@/shared/lib/api";
import { AUTH_ME_QUERY_KEY, getMe, type AuthUser } from "./api";

export function useAuthMeQuery(enabled = true) {
  const { token, user } = useAuthContext();
  const effectiveToken = token ?? getToken();

  return useQuery<AuthUser, ApiError>({
    queryKey: AUTH_ME_QUERY_KEY,
    queryFn: () => getMe(),
    enabled: enabled && Boolean(effectiveToken),
    initialData: user ?? undefined,
    staleTime: 30_000,
    retry: false,
  });
}
