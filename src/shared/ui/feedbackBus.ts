export type FeedbackLevel =
  | "default"
  | "info"
  | "success"
  | "warning"
  | "error";

export type FeedbackPresentation = "snackbar" | "banner";

export type FeedbackPayload = {
  id: string;
  message: string;
  level: FeedbackLevel;
  presentation?: FeedbackPresentation;
  durationMs?: number;
  actionLabel?: string;
  onAction?: () => void;
  dedupeKey?: string;
};

type FeedbackEvent =
  | {
      type: "show";
      payload: FeedbackPayload;
    }
  | {
      type: "dismiss";
      id?: string;
    };

type FeedbackListener = (event: FeedbackEvent) => void;

const listeners = new Set<FeedbackListener>();

let feedbackCount = 0;

function createFeedbackId() {
  feedbackCount = (feedbackCount + 1) % Number.MAX_SAFE_INTEGER;
  return `feedback-${feedbackCount}`;
}

export function getDefaultFeedbackPresentation(
  level: FeedbackLevel,
): FeedbackPresentation {
  return level === "info" ? "banner" : "snackbar";
}

export function getDefaultFeedbackDuration(
  level: FeedbackLevel,
  presentation: FeedbackPresentation,
) {
  if (presentation === "banner") return 4200;
  if (level === "success") return 2600;
  if (level === "warning") return 3400;
  if (level === "error") return 3800;
  return 3000;
}

export function subscribeToFeedback(listener: FeedbackListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitFeedback(
  payload: Omit<FeedbackPayload, "id"> & { id?: string },
) {
  const message = payload.message.trim();
  if (!message) return null;

  const normalizedPayload: FeedbackPayload = {
    ...payload,
    id: payload.id ?? createFeedbackId(),
    message,
    presentation:
      payload.presentation ?? getDefaultFeedbackPresentation(payload.level),
  };

  listeners.forEach((listener) =>
    listener({
      type: "show",
      payload: normalizedPayload,
    }),
  );

  return normalizedPayload.id;
}

export function dismissFeedback(id?: string) {
  listeners.forEach((listener) =>
    listener({
      type: "dismiss",
      id,
    }),
  );
}
