export function hasResetToken(resetToken?: string | null) {
  return typeof resetToken === "string" && resetToken.trim().length > 0;
}

export function isResetTokenExpired(expiresAt: string, nowMs: number = Date.now()) {
  const parsed = new Date(expiresAt);
  if (Number.isNaN(parsed.getTime())) return true;
  return parsed.getTime() <= nowMs;
}
