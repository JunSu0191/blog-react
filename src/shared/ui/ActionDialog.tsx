import type { ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui";
import { cn } from "@/lib/utils";

type ActionDialogProps = {
  open: boolean;
  title: ReactNode;
  content?: ReactNode;
  onOpenChange?: (open: boolean) => void;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: ReactNode;
  cancelText?: ReactNode;
  preventAutoCloseOnConfirm?: boolean;
  confirmDisabled?: boolean;
  cancelDisabled?: boolean;
  contentClassName?: string;
  confirmClassName?: string;
  cancelClassName?: string;
  footerClassName?: string;
};

export default function ActionDialog({
  open,
  title,
  content,
  onOpenChange,
  onConfirm,
  onCancel,
  confirmText = "확인",
  cancelText,
  preventAutoCloseOnConfirm = false,
  confirmDisabled = false,
  cancelDisabled = false,
  contentClassName,
  confirmClassName,
  cancelClassName,
  footerClassName,
}: ActionDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-sm border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-base font-black text-slate-900 dark:text-slate-100">
            {title}
          </AlertDialogTitle>
          {content ? (
            <AlertDialogDescription
              className={cn(
                "text-sm text-slate-500 dark:text-slate-400",
                contentClassName,
              )}
            >
              {content}
            </AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter className={cn("sm:justify-end", footerClassName)}>
          {cancelText ? (
            <AlertDialogCancel
              disabled={cancelDisabled}
              onClick={onCancel}
              className={cn(
                "rounded-xl border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800",
                cancelClassName,
              )}
            >
              {cancelText}
            </AlertDialogCancel>
          ) : null}
          <AlertDialogAction
            disabled={confirmDisabled}
            className={cn(
              "rounded-xl bg-blue-600 text-white hover:bg-blue-700",
              confirmClassName,
            )}
            onClick={(event) => {
              if (preventAutoCloseOnConfirm) {
                event.preventDefault();
              }
              onConfirm?.();
            }}
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
