import { AlertTriangle, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuthContext } from "@/shared/context/useAuthContext";
import { parseErrorMessage } from "@/shared/lib/errorParser";
import { Button, ThemeToggle } from "@/shared/ui";
import { useToast } from "@/shared/ui/ToastProvider";
import {
  clearPostLoginRedirectPath,
  consumePostLoginRedirectPath,
  parseOAuthCallbackResult,
} from "../oauth";

type CallbackPhase = "processing" | "error";

type CallbackState = {
  phase: CallbackPhase;
  message: string;
};

export default function OAuthCallbackPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginWithToken } = useAuthContext();
  const { error: showToastError } = useToast();
  const handledRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const callbackPayload = useMemo(
    () => parseOAuthCallbackResult(location.search, location.hash),
    [location.hash, location.search],
  );
  const [state, setState] = useState<CallbackState>({
    phase: "processing",
    message: "소셜 로그인 처리 중입니다...",
  });

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    const redirectToLoginWithError = (message: string) => {
      clearPostLoginRedirectPath();
      setState({
        phase: "error",
        message,
      });
      showToastError(message);
      timerRef.current = window.setTimeout(() => {
        navigate("/login", { replace: true });
      }, 1500);
    };

    void (async () => {
      if (callbackPayload.token) {
        try {
          await loginWithToken(callbackPayload.token);
          const nextPath = consumePostLoginRedirectPath();
          navigate(nextPath, { replace: true });
          return;
        } catch (error) {
          redirectToLoginWithError(
            parseErrorMessage(error, "소셜 로그인 처리 중 오류가 발생했습니다."),
          );
          return;
        }
      }

      if (callbackPayload.errorCode || callbackPayload.errorMessage) {
        const message =
          callbackPayload.errorMessage ||
          (callbackPayload.errorCode
            ? `소셜 로그인에 실패했습니다. (${callbackPayload.errorCode})`
            : "소셜 로그인에 실패했습니다.");
        redirectToLoginWithError(message);
        return;
      }

      redirectToLoginWithError("유효하지 않은 접근입니다.");
    })();

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [callbackPayload, loginWithToken, navigate, showToastError]);

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4 dark:from-slate-950 dark:to-slate-900">
      <ThemeToggle className="absolute right-4 top-4" />
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg dark:border-slate-800 dark:bg-slate-900">
        {state.phase === "processing" ? (
          <>
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-blue-600 dark:text-blue-300" />
            <h2 className="mt-4 text-2xl font-bold text-slate-900 dark:text-slate-100">
              로그인 처리 중
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              {state.message}
            </p>
          </>
        ) : (
          <>
            <AlertTriangle className="mx-auto h-10 w-10 text-rose-600 dark:text-rose-300" />
            <h2 className="mt-4 text-2xl font-bold text-rose-700 dark:text-rose-200">
              로그인 실패
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {state.message}
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-6 w-full"
              onClick={() => navigate("/login", { replace: true })}
              aria-label="로그인 페이지로 이동"
            >
              로그인으로 이동
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
