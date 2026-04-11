import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import { FeedbackViewport } from "./FeedbackViewport";
import {
  emitFeedback,
  type FeedbackLevel as ToastLevel,
} from "./feedbackBus";

type ToastContextValue = {
  showToast: (message: string, type?: ToastLevel) => void;
  info: (message: string) => void;
  success: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const value = useMemo(
    () => ({
      showToast: (message: string, type: ToastLevel = "default") => {
        emitFeedback({
          message,
          level: type,
        });
      },
      info: (message: string) => {
        emitFeedback({
          message,
          level: "info",
        });
      },
      success: (message: string) => {
        emitFeedback({
          message,
          level: "success",
        });
      },
      warn: (message: string) => {
        emitFeedback({
          message,
          level: "warning",
        });
      },
      error: (message: string) => {
        emitFeedback({
          message,
          level: "error",
        });
      },
    }),
    [],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <FeedbackViewport />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("ToastProvider가 설정되지 않았습니다.");
  return ctx;
}
