import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuthContext } from "../../../shared/context/useAuthContext";
import { Input, Button, ThemeToggle } from "../../../shared/ui";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isComposingPassword, setIsComposingPassword] = useState(false);
  const [isComposingPasswordConfirm, setIsComposingPasswordConfirm] =
    useState(false);
  const navigate = useNavigate();

  const { register: doRegister, token } = useAuthContext();

  // 이미 로그인되어 있다면 홈으로 리다이렉트
  useEffect(() => {
    if (token) {
      navigate("/posts", { replace: true });
    }
  }, [token, navigate]);

  const passwordError =
    password && passwordConfirm && password !== passwordConfirm
      ? "비밀번호가 일치하지 않습니다"
      : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!username.trim()) {
      setError("아이디를 입력해주세요");
      return;
    }

    if (!name.trim()) {
      setError("이름을 입력해주세요");
      return;
    }

    if (!password) {
      setError("비밀번호를 입력해주세요");
      return;
    }

    if (password !== passwordConfirm) {
      setError("비밀번호가 일치하지 않습니다");
      return;
    }

    if (password.length < 6) {
      setError("비밀번호는 최소 6자 이상이어야 합니다");
      return;
    }

    setIsLoading(true);
    try {
      await doRegister(username, name, password);
      navigate("/posts");
    } catch (err: any) {
      setError(err?.message ?? "회원가입에 실패했습니다");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4 dark:from-slate-950 dark:to-slate-900">
      <ThemeToggle className="absolute right-4 top-4" />
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-lg dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-2 text-3xl font-bold text-slate-900 dark:text-slate-100">회원가입</h2>
        <p className="mb-8 text-slate-600 dark:text-slate-400">새로운 계정을 만들어보세요</p>

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
            label="이름"
            placeholder="이름"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isLoading}
          />

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
              비밀번호
            </label>
            <input
              type="password"
              placeholder="비밀번호를 입력해주세요"
              value={password}
              onCompositionStart={() => setIsComposingPassword(true)}
              onCompositionEnd={(e) => {
                setIsComposingPassword(false);
                setPassword(e.currentTarget.value);
              }}
              onChange={(e) => {
                if (!isComposingPassword) {
                  setPassword(e.target.value);
                }
              }}
              disabled={isLoading}
              autoComplete="new-password"
              className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400"
              style={{ textTransform: "none" }}
            />
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              최소 6자 이상
              {isComposingPassword && (
                <span className="ml-2 text-orange-600 dark:text-orange-400">
                  ⚠️ 한글 입력 모드에서는 영문자가 대문자로 입력될 수 있습니다
                </span>
              )}
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
              비밀번호 확인
            </label>
            <input
              type="password"
              placeholder="비밀번호를 다시 입력해주세요"
              value={passwordConfirm}
              onCompositionStart={() => setIsComposingPasswordConfirm(true)}
              onCompositionEnd={(e) => {
                setIsComposingPasswordConfirm(false);
                setPasswordConfirm(e.currentTarget.value);
              }}
              onChange={(e) => {
                if (!isComposingPasswordConfirm) {
                  setPasswordConfirm(e.target.value);
                }
              }}
              disabled={isLoading}
              autoComplete="new-password"
              className={`h-10 w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 ${
                passwordError
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500/20 dark:border-red-500"
                  : "border-slate-300 focus:border-blue-500 focus:ring-blue-500/20 dark:border-slate-700 dark:focus:border-blue-400"
              }`}
              style={{ textTransform: "none" }}
            />
            {passwordError && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{passwordError}</p>
            )}
            {isComposingPasswordConfirm && !passwordError && (
              <p className="mt-1 text-sm text-orange-600 dark:text-orange-400">
                ⚠️ 한글 입력 모드에서는 영문자가 대문자로 입력될 수 있습니다
              </p>
            )}
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full mt-6"
            isLoading={isLoading}
            disabled={passwordError !== null || isLoading}
          >
            회원가입
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            이미 계정이 있으신가요?{" "}
            <Link
              to="/login"
              className="font-medium text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
            >
              로그인
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
