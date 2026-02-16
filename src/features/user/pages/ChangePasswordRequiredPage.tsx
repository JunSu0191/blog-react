import { LockKeyhole } from "lucide-react";

export default function ChangePasswordRequiredPage() {
  return (
    <div className="route-enter flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-lg rounded-3xl border border-amber-200 bg-amber-50/80 p-8 text-center shadow-sm dark:border-amber-900/50 dark:bg-amber-950/25">
        <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300">
          <LockKeyhole className="h-7 w-7" aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-2xl font-black tracking-tight text-amber-700 dark:text-amber-200">
          비밀번호 변경이 필요합니다
        </h1>
        <p className="mt-2 text-sm text-amber-700/90 dark:text-amber-200/80">
          보안 정책상 비밀번호 변경 후 서비스를 사용할 수 있습니다.
        </p>
      </div>
    </div>
  );
}
