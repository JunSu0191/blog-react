import { parseErrorMessage } from "./errorParser";
import { emitFeedback } from "@/shared/ui/feedbackBus";

export function showErrorToast(
  error: unknown,
  fallback?: string,
) {
  emitFeedback({
    message: parseErrorMessage(error, fallback),
    level: "error",
  });
}
