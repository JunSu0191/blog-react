import type { ReactNode } from "react";
import * as Sentry from "@sentry/react";
import { Button } from "@/shared/ui";
import { captureException } from "@/shared/lib/monitoring";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorFallbackProps = {
  error: unknown;
  resetError: () => void;
};

function ErrorFallback({ error, resetError }: ErrorFallbackProps) {
  const message =
    error instanceof Error && error.message.trim()
      ? error.message
      : "예상하지 못한 오류가 발생했습니다.";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="w-full max-w-lg rounded-3xl border border-rose-200 bg-white p-8 shadow-sm dark:border-rose-900/60 dark:bg-slate-900">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-600 dark:text-rose-300">
          Application Error
        </p>
        <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
          화면을 표시하지 못했습니다.
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
          잠시 후 다시 시도해 주세요. 문제가 반복되면 배포 환경 설정과 최근 변경 사항을
          먼저 확인하는 편이 빠릅니다.
        </p>
        {import.meta.env.DEV ? (
          <pre className="mt-4 overflow-x-auto rounded-2xl bg-slate-950 px-4 py-3 text-xs text-slate-100">
            {message}
          </pre>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-2">
          <Button type="button" onClick={resetError}>
            다시 시도
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              window.location.assign("/home");
            }}
          >
            홈으로 이동
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AppErrorBoundary({ children }: AppErrorBoundaryProps) {
  return (
    <Sentry.ErrorBoundary
      fallback={({ error, resetError }) => (
        <ErrorFallback error={error} resetError={resetError} />
      )}
      onError={(error, componentStack) => {
        captureException(error, {
          tags: {
            scope: "react-error-boundary",
          },
          extra: {
            componentStack,
          },
        });
      }}
    >
      {children}
    </Sentry.ErrorBoundary>
  );
}
