import { toast } from "react-toastify";
import { parseErrorMessage } from "./errorParser";

export function showErrorToast(
  error: unknown,
  fallback?: string,
) {
  toast.error(parseErrorMessage(error, fallback));
}
