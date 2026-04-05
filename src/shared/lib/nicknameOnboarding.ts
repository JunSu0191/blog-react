const STORAGE_PREFIX = "onboarding.nickname.completed";

function getStorageKey(userId: number) {
  return `${STORAGE_PREFIX}:${userId}`;
}

export function hasCompletedNicknameOnboarding(userId?: number | null) {
  if (typeof window === "undefined") return false;
  if (typeof userId !== "number") return false;
  return window.localStorage.getItem(getStorageKey(userId)) === "1";
}

export function markNicknameOnboardingCompleted(userId?: number | null) {
  if (typeof window === "undefined") return;
  if (typeof userId !== "number") return;
  window.localStorage.setItem(getStorageKey(userId), "1");
}
