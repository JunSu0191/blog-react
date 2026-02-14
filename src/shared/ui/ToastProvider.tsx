import { createContext, useCallback, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import {
  ToastContainer,
  cssTransition,
  toast,
  type ToastOptions,
  type TypeOptions,
} from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

type ToastLevel = TypeOptions;

type ToastContextValue = {
  showToast: (message: string, type?: ToastLevel) => void;
  info: (message: string) => void;
  success: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const notificationTransition = cssTransition({
  enter: "toast-slide-in-right",
  exit: "toast-slide-out-left",
  collapse: true,
  collapseDuration: 200,
});

const toastOptions: ToastOptions = {
  autoClose: 4000,
  closeOnClick: true,
  pauseOnFocusLoss: true,
  pauseOnHover: true,
  draggable: true,
  theme: "colored",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const showToast = useCallback((message: string, type: ToastLevel = "default") => {
    const normalized = message.trim();
    if (!normalized) return;

    if (type === "info") {
      toast.info(normalized, toastOptions);
      return;
    }
    if (type === "success") {
      toast.success(normalized, toastOptions);
      return;
    }
    if (type === "warning") {
      toast.warn(normalized, toastOptions);
      return;
    }
    if (type === "error") {
      toast.error(normalized, toastOptions);
      return;
    }

    toast(normalized, toastOptions);
  }, []);

  const info = useCallback((message: string) => showToast(message, "info"), [showToast]);
  const success = useCallback((message: string) => showToast(message, "success"), [showToast]);
  const warn = useCallback((message: string) => showToast(message, "warning"), [showToast]);
  const error = useCallback((message: string) => showToast(message, "error"), [showToast]);

  const value = useMemo(
    () => ({ showToast, info, success, warn, error }),
    [showToast, info, success, warn, error],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        closeOnClick
        pauseOnFocusLoss
        pauseOnHover
        draggable
        theme="colored"
        transition={notificationTransition}
        newestOnTop
        limit={4}
        className="!z-[120]"
      />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("ToastProvider가 설정되지 않았습니다.");
  return ctx;
}
