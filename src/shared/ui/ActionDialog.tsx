import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Check, CircleAlert, X } from "lucide-react";
import type { ReactNode } from "react";
import Button from "./Button";
import { cn } from "@/shared/lib/cn";

type ActionDialogProps = {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  content?: ReactNode;
  onOpenChange?: (open: boolean) => void;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: ReactNode;
  cancelText?: ReactNode;
  icon?: ReactNode;
  confirmIcon?: ReactNode;
  cancelIcon?: ReactNode;
  preventAutoCloseOnConfirm?: boolean;
  confirmDisabled?: boolean;
  cancelDisabled?: boolean;
  contentClassName?: string;
  titleClassName?: string;
  dialogClassName?: string;
  overlayClassName?: string;
  iconWrapperClassName?: string;
  confirmClassName?: string;
  cancelClassName?: string;
  footerClassName?: string;
  closeOnEsc?: boolean;
  closeOnOverlayClick?: boolean;
  trapFocus?: boolean;
};

export default function ActionDialog({
  open,
  title,
  description,
  content,
  onOpenChange,
  onConfirm,
  onCancel,
  confirmText = "확인",
  cancelText,
  icon,
  confirmIcon,
  cancelIcon,
  preventAutoCloseOnConfirm = false,
  confirmDisabled = false,
  cancelDisabled = false,
  contentClassName,
  titleClassName,
  dialogClassName,
  overlayClassName,
  iconWrapperClassName,
  confirmClassName,
  cancelClassName,
  footerClassName,
  closeOnEsc = true,
  closeOnOverlayClick = true,
  trapFocus = true,
}: ActionDialogProps) {
  const descriptionNode = typeof description !== "undefined" ? description : content;
  const iconNode =
    icon === null ? null : (
      icon ?? <CircleAlert className="h-5 w-5" aria-hidden="true" />
    );
  const confirmIconNode =
    confirmIcon === null ? null : (
      confirmIcon ?? <Check className="h-4 w-4" aria-hidden="true" />
    );
  const cancelIconNode =
    cancelIcon === null ? null : (
      cancelIcon ?? <X className="h-4 w-4" aria-hidden="true" />
    );

  const handleCancel = () => {
    onCancel?.();
    onOpenChange?.(false);
  };

  const handleConfirm = () => {
    if (!preventAutoCloseOnConfirm) {
      onOpenChange?.(false);
    }
    onConfirm?.();
  };

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={onOpenChange}
      modal={trapFocus}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-[400] bg-slate-950/60 backdrop-blur-[1.5px] data-[state=open]:animate-[action-dialog-fade-in_200ms_ease-out] data-[state=closed]:animate-[action-dialog-fade-out_150ms_ease-in]",
            overlayClassName,
          )}
        />

        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-[410] w-[calc(100%-2.5rem)] max-w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_28px_70px_-40px_rgba(15,23,42,0.7)] outline-none data-[state=open]:animate-[action-dialog-fade-in_200ms_ease-out] data-[state=closed]:animate-[action-dialog-fade-out_150ms_ease-in] dark:border-slate-700 dark:bg-slate-900",
            dialogClassName,
          )}
          onEscapeKeyDown={(event) => {
            if (!closeOnEsc) {
              event.preventDefault();
            }
          }}
          onPointerDownOutside={(event) => {
            if (!closeOnOverlayClick) {
              event.preventDefault();
            }
          }}
        >
          <div className="space-y-5">
            {(iconNode || title || descriptionNode) && (
              <div className="space-y-3 text-center">
                {iconNode && (
                  <div className="flex justify-center">
                    <div
                      className={cn(
                        "inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
                        iconWrapperClassName,
                      )}
                    >
                      {iconNode}
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <DialogPrimitive.Title
                    className={cn(
                      "text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-100",
                      titleClassName,
                    )}
                  >
                    {title}
                  </DialogPrimitive.Title>

                  {descriptionNode ? (
                    <DialogPrimitive.Description
                      className={cn(
                        "text-sm leading-6 text-slate-500 dark:text-slate-400",
                        contentClassName,
                      )}
                    >
                      {descriptionNode}
                    </DialogPrimitive.Description>
                  ) : null}
                </div>
              </div>
            )}

            <div
              className={cn(
                "flex flex-col-reverse gap-2 sm:flex-row sm:justify-center",
                footerClassName,
              )}
            >
              {cancelText ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={cancelDisabled}
                  onClick={handleCancel}
                  className={cn(
                    "h-10 min-w-[108px] rounded-lg border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800",
                    cancelClassName,
                  )}
                >
                  {cancelIconNode ? (
                    <span className="inline-flex items-center justify-center">{cancelIconNode}</span>
                  ) : null}
                  {cancelText}
                </Button>
              ) : null}

              <Button
                type="button"
                disabled={confirmDisabled}
                onClick={handleConfirm}
                className={cn(
                  "h-10 min-w-[108px] rounded-lg bg-blue-600 text-white hover:bg-blue-700",
                  confirmClassName,
                )}
              >
                {confirmIconNode ? (
                  <span className="inline-flex items-center justify-center">{confirmIconNode}</span>
                ) : null}
                {confirmText}
              </Button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
