import { useEffect, useState, type ReactElement } from "react";
import { Lock, LogIn, X } from "lucide-react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuthMeQuery } from "@/features/user/queries";
import { useAuthContext } from "@/shared/context/useAuthContext";
import { ActionDialog } from "@/shared/ui";
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

function AuthRequiredPrompt() {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);

  useEffect(() => {
    setOpen(true);
  }, [location.pathname]);

  const goToPosts = () => {
    navigate("/posts", { replace: true });
  };

  return (
    <div className="route-enter flex min-h-[36vh] items-center justify-center">
      <ActionDialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            goToPosts();
          }
        }}
        icon={<Lock className="h-5 w-5" aria-hidden="true" />}
        title="로그인이 필요합니다"
        description="로그인 페이지로 이동하시겠습니까?"
        cancelIcon={<X className="h-4 w-4" aria-hidden="true" />}
        confirmIcon={<LogIn className="h-4 w-4" aria-hidden="true" />}
        cancelText="나중에 로그인하기"
        confirmText="로그인 페이지 이동"
        onCancel={goToPosts}
        onConfirm={() => {
          navigate("/login", { state: { from: location } });
        }}
        preventAutoCloseOnConfirm
      />
    </div>
  );
}

export function RequireAuth({ children }: GuardProps) {
  const location = useLocation();
  const { user, isLoadingUser } = useAuthContext();

  if (isLoadingUser) {
    return <GuardLoader />;
  }

  if (!user) {
    return <AuthRequiredPrompt />;
  }

  if (user.mustChangePassword === true && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }

  if (hasSuspendedStatus(user.status)) {
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
