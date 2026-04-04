import React, { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthContext } from "../../../shared/context/useAuthContext";
import { Input, Button, ThemeToggle } from "../../../shared/ui";
import { parseErrorMessage } from "@/shared/lib/errorParser";
import { useToast } from "@/shared/ui/ToastProvider";
import {
  getOAuthAuthorizationUrl,
  persistPostLoginRedirectPath,
  resolveRedirectPathFromState,
  type OAuthProvider,
} from "../oauth";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-[18px] w-[18px]" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
      <path fill="none" d="M0 0h48v48H0z" />
    </svg>
  );
}

function KakaoIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 3C7.03 3 3 6.17 3 10.08c0 2.48 1.66 4.67 4.17 5.91L6 21l5-3.34c.33.03.66.05 1 .05 4.97 0 9-3.17 9-7.08C21 6.17 16.97 3 12 3z"
      />
    </svg>
  );
}

function NaverIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
      <path
        fill="currentColor"
        d="M16.273 12.845 7.83 0H0v24h7.726V11.155L16.17 24H24V0h-7.727z"
      />
    </svg>
  );
}

const SOCIAL_LOGIN_OPTIONS: Array<{
  provider: OAuthProvider;
  label: string;
  icon: ReactNode;
  buttonClassName: string;
}> = [
  {
    provider: "google",
    label: "Google",
    icon: <GoogleIcon />,
    buttonClassName:
      "!border-[#747775] !bg-white text-[#1f1f1f] hover:shadow-[0_1px_2px_0_rgba(60,64,67,0.30),0_1px_3px_1px_rgba(60,64,67,0.15)]",
  },
  {
    provider: "kakao",
    label: "Kakao",
    icon: <KakaoIcon />,
    buttonClassName:
      "!border-[#FEE500] !bg-[#FEE500] text-[#191919] hover:!bg-[#f7dc00] hover:shadow-[0_1px_2px_0_rgba(0,0,0,0.30),0_1px_3px_1px_rgba(0,0,0,0.15)]",
  },
  {
    provider: "naver",
    label: "Naver",
    icon: <NaverIcon />,
    buttonClassName:
      "!border-[#03C75A] !bg-[#03C75A] text-white hover:!bg-[#02b351] hover:shadow-[0_1px_2px_0_rgba(3,199,90,0.35),0_1px_3px_1px_rgba(3,199,90,0.25)]",
  },
];

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { info } = useToast();
  const redirectPath = useMemo(
    () => resolveRedirectPathFromState(location.state),
    [location.state],
  );

  const { login: doLogin, token } = useAuthContext();
  const isSocialLoginEnabled = !import.meta.env.PROD;

  // 이미 로그인되어 있다면 홈으로 리다이렉트
  useEffect(() => {
    if (token) {
      navigate(redirectPath, { replace: true });
    }
  }, [token, navigate, redirectPath]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!username.trim()) {
      setError("아이디를 입력해주세요");
      return;
    }

    if (!password) {
      setError("비밀번호를 입력해주세요");
      return;
    }

    setIsLoading(true);
    try {
      await doLogin(username, password);
      navigate(redirectPath, { replace: true });
    } catch (error: unknown) {
      setError(parseErrorMessage(error, "로그인에 실패했습니다"));
    } finally {
      setIsLoading(false);
    }
  }

  function handleSocialLogin(provider: OAuthProvider) {
    setError(null);
    if (!isSocialLoginEnabled) {
      info("소셜 로그인은 현재 준비 중입니다.");
      return;
    }
    persistPostLoginRedirectPath(redirectPath);
    window.location.href = getOAuthAuthorizationUrl(provider);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4 dark:from-slate-950 dark:to-slate-900">
      <ThemeToggle className="absolute right-4 top-4" />
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-lg dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-2 text-3xl font-bold text-slate-900 dark:text-slate-100">로그인</h2>
        <p className="mb-8 text-slate-600 dark:text-slate-400">계정에 로그인하세요</p>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="아이디"
            placeholder="아이디"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={isLoading}
          />

          <Input
            label="비밀번호"
            type="password"
            placeholder="비밀번호를 입력해주세요"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="mt-6 w-full"
            isLoading={isLoading}
          >
            로그인
          </Button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
            OR
          </span>
          <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
        </div>

        <div className="flex items-center justify-center gap-4">
          {SOCIAL_LOGIN_OPTIONS.map((option) => (
            <Button
              key={option.provider}
              type="button"
              variant="outline"
              className={[
                "group relative !h-10 !w-10 !min-w-0 !rounded-[20px] !p-0 !shadow-none",
                option.buttonClassName,
              ].join(" ")}
              disabled={isLoading}
              onClick={() => handleSocialLogin(option.provider)}
              aria-label={`${option.label} 로그인`}
              title={`${option.label} 로그인`}
            >
              <span className="absolute inset-0 rounded-[20px] bg-[#303030]/0 transition-opacity group-active:bg-[#303030]/[0.12] group-focus-visible:bg-[#303030]/[0.12] group-hover:bg-[#303030]/[0.08]" />
              <span className="relative inline-flex h-full w-full items-center justify-center">
                {option.icon}
                <span className="sr-only">{option.label}로 로그인</span>
              </span>
            </Button>
          ))}
        </div>
        {!isSocialLoginEnabled ? (
          <p className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">
            소셜 로그인은 현재 준비 중입니다.
          </p>
        ) : null}

        <div className="mt-6 text-center">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            계정이 없으신가요?{" "}
            <Link
              to="/register"
              className="font-medium text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
            >
              회원가입
            </Link>
          </p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            <Link
              to="/find-id"
              className="font-medium text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
            >
              아이디 찾기
            </Link>
            {" · "}
            <Link
              to="/reset-password"
              className="font-medium text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
            >
              비밀번호 재설정
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
