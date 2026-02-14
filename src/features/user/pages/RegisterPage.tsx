import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuthContext } from "../../../shared/context/useAuthContext";
import { Input, Button } from "../../../shared/ui";

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">회원가입</h2>
        <p className="text-slate-600 mb-8">새로운 계정을 만들어보세요</p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
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
            <label className="block text-sm font-medium text-slate-700 mb-2">
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
              className="w-full px-4 py-2.5 text-base bg-white border border-slate-200 rounded-lg transition-all duration-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-slate-300 placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-500 disabled:border-slate-200"
              style={{ textTransform: "none" }}
            />
            <p className="text-sm text-slate-500 mt-1">
              최소 6자 이상
              {isComposingPassword && (
                <span className="text-orange-600 ml-2">
                  ⚠️ 한글 입력 모드에서는 영문자가 대문자로 입력될 수 있습니다
                </span>
              )}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
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
              className={`w-full px-4 py-2.5 text-base bg-white border rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 hover:border-slate-300 placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-500 disabled:border-slate-200 ${
                passwordError
                  ? "border-red-500 focus:ring-red-500/20 focus:border-red-500"
                  : "border-slate-200 focus:border-blue-500 focus:ring-blue-500/20"
              }`}
              style={{ textTransform: "none" }}
            />
            {passwordError && (
              <p className="text-sm text-red-600 mt-1">{passwordError}</p>
            )}
            {isComposingPasswordConfirm && !passwordError && (
              <p className="text-sm text-orange-600 mt-1">
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
          <p className="text-slate-600 text-sm">
            이미 계정이 있으신가요?{" "}
            <Link
              to="/login"
              className="font-medium text-blue-600 hover:text-blue-700 transition-colors"
            >
              로그인
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
