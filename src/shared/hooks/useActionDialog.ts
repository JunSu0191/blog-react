import { useCallback, useMemo, useState, type ReactNode } from "react";

type ActionDialogPayload = {
  title?: ReactNode;
  content?: ReactNode;
};

type ActionDialogInput = ReactNode | ActionDialogPayload;

type UseActionDialogOptions = {
  defaultTitle?: ReactNode;
  defaultContent?: ReactNode;
};

function isPayloadObject(value: ActionDialogInput): value is ActionDialogPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    ("title" in value || "content" in value)
  );
}

export default function useActionDialog({
  defaultTitle = "안내",
  defaultContent = "",
}: UseActionDialogOptions = {}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState<ReactNode>(defaultTitle);
  const [content, setContent] = useState<ReactNode>(defaultContent);

  const show = useCallback(
    (input?: ActionDialogInput) => {
      if (typeof input === "undefined") {
        setTitle(defaultTitle);
        setContent(defaultContent);
      } else if (isPayloadObject(input)) {
        setTitle(input.title ?? defaultTitle);
        setContent(input.content ?? defaultContent);
      } else {
        setTitle(defaultTitle);
        setContent(input);
      }
      setOpen(true);
    },
    [defaultContent, defaultTitle],
  );

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const dialogProps = useMemo(
    () => ({
      open,
      title,
      content,
      onOpenChange: setOpen,
      onConfirm: close,
    }),
    [close, content, open, title],
  );

  return {
    open,
    title,
    content,
    show,
    close,
    setOpen,
    setTitle,
    setContent,
    dialogProps,
  };
}
