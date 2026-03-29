import { useQuery } from "@tanstack/react-query";
import { useAuthContext } from "@/shared/context/useAuthContext";
import type { ApiError } from "@/shared/lib/api";
import { AUTH_ME_QUERY_KEY, getMe, type AuthUser } from "./api";

export function useAuthMeQuery(enabled = true) {
  const { user } = useAuthContext();

  return useQuery<AuthUser | null, ApiError>({
    queryKey: AUTH_ME_QUERY_KEY,
    queryFn: () => getMe(),
    enabled,
    initialData: user ?? undefined,
    staleTime: 30_000,
    retry: false,
  });
}
