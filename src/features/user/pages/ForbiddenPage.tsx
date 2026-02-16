import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/shared/ui";

export default function ForbiddenPage() {
  return (
    <div className="route-enter flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-lg rounded-3xl border border-rose-200 bg-rose-50/80 p-8 text-center shadow-sm dark:border-rose-900/50 dark:bg-rose-950/25">
        <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300">
          <ShieldAlert className="h-7 w-7" aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-2xl font-black tracking-tight text-rose-700 dark:text-rose-200">
          접근 권한이 없습니다
        </h1>
        <p className="mt-2 text-sm text-rose-700/90 dark:text-rose-200/80">
          요청한 페이지는 관리자 권한이 필요하거나 계정 상태로 인해 접근할 수 없습니다.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <Link to="/posts">
            <Button type="button" variant="outline" aria-label="메인으로 이동">
              메인으로 이동
            </Button>
          </Link>
          <Link to="/login">
            <Button type="button" aria-label="로그인 페이지로 이동">
              다시 로그인
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
