import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuthContext } from "../../../shared/context/useAuthContext";
import { Input, Button } from "../../../shared/ui";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const { login: doLogin, token } = useAuthContext();

  // 이미 로그인되어 있다면 홈으로 리다이렉트
  useEffect(() => {
    if (token) {
      navigate("/posts", { replace: true });
    }
  }, [token, navigate]);

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
      navigate("/posts");
    } catch (error: any) {
      console.log("Login error caught:", error);
      console.log("Error message:", error?.message);
      setError(error?.message ?? "로그인에 실패했습니다");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">로그인</h2>
        <p className="text-slate-600 mb-8">계정에 로그인하세요</p>

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
            className="w-full mt-6"
            isLoading={isLoading}
          >
            로그인
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-slate-600 text-sm">
            계정이 없으신가요?{" "}
            <Link
              to="/register"
              className="font-medium text-blue-600 hover:text-blue-700 transition-colors"
            >
              회원가입
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
