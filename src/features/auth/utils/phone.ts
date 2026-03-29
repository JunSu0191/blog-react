export function normalizePhoneNumber(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return "";

  const startsWithPlus = trimmed.startsWith("+");
  const digitsOnly = trimmed.replace(/[^\d]/g, "");

  if (!digitsOnly) return "";
  return startsWithPlus ? `+${digitsOnly}` : digitsOnly;
}

export function isValidPhoneNumber(input: string) {
  const normalized = normalizePhoneNumber(input);
  const digits = normalized.replace(/[^\d]/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

export function formatCooldownTime(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  const minuteText = String(minutes).padStart(2, "0");
  const secondText = String(seconds).padStart(2, "0");
  return `${minuteText}:${secondText}`;
}
