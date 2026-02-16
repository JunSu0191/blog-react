import type { ReactElement } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthMeQuery } from "@/features/user/queries";
import { useAuthContext } from "@/shared/context/useAuthContext";
import { getToken } from "@/shared/lib/auth";

type GuardProps = {
  children: ReactElement;
};

function GuardLoader() {
  return (
    <div className="route-enter flex min-h-[48vh] flex-col items-center justify-center gap-3">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
      <p className="text-sm font-semibold text-slate-500">권한 확인 중...</p>
    </div>
  );
}

function hasSuspendedStatus(status?: string) {
  return status?.toUpperCase() === "SUSPENDED";
}

function isAdminRole(role?: string) {
  return role?.toUpperCase() === "ADMIN";
}

export function RequireAuth({ children }: GuardProps) {
  const location = useLocation();
  const { token, user, isLoadingUser } = useAuthContext();
  const effectiveToken = token ?? getToken();
  const meQuery = useAuthMeQuery(Boolean(effectiveToken));
  const resolvedUser = meQuery.data ?? user;

  if (!effectiveToken) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if ((isLoadingUser || meQuery.isLoading) && !resolvedUser) {
    return <GuardLoader />;
  }

  if (meQuery.isError && meQuery.error?.status === 403) {
    return <Navigate to="/403" replace />;
  }

  if (!resolvedUser) {
    return <Navigate to="/login" replace />;
  }

  if (resolvedUser.mustChangePassword === true && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }

  if (hasSuspendedStatus(resolvedUser.status)) {
    return <Navigate to="/403" replace />;
  }

  return children;
}

export function AdminGuard({ children }: GuardProps) {
  const location = useLocation();
  const { token, user, isLoadingUser } = useAuthContext();
  const effectiveToken = token ?? getToken();
  const meQuery = useAuthMeQuery(Boolean(effectiveToken));
  const resolvedUser = meQuery.data ?? user;

  if (!effectiveToken) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if ((isLoadingUser || meQuery.isLoading) && !resolvedUser) {
    return <GuardLoader />;
  }

  if (meQuery.isError && meQuery.error?.status === 401) {
    return <Navigate to="/login" replace />;
  }

  if (meQuery.isError && meQuery.error?.status === 403) {
    return <Navigate to="/403" replace />;
  }

  if (!resolvedUser) {
    return <Navigate to="/login" replace />;
  }

  if (resolvedUser.mustChangePassword === true && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }

  if (hasSuspendedStatus(resolvedUser.status) || !isAdminRole(resolvedUser.role)) {
    return <Navigate to="/403" replace />;
  }

  return children;
}
