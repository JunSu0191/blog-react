type DisplayNameSource = {
  nickname?: string | null;
  displayName?: string | null;
  name?: string | null;
  username?: string | null;
};

const GENERATED_HANDLE_PATTERN =
  /^(google|naver|kakao)_[a-z0-9_-]{8,}$/i;

function normalizeText(value?: string | null) {
  if (typeof value !== "string") return "";
  return value.trim();
}

export function isGeneratedHandle(value?: string | null) {
  const normalized = normalizeText(value);
  if (!normalized) return false;
  return GENERATED_HANDLE_PATTERN.test(normalized);
}

function isUsablePublicName(value?: string | null, username?: string | null) {
  const normalized = normalizeText(value);
  if (!normalized) return false;

  const normalizedUsername = normalizeText(username);
  if (normalizedUsername && normalized === normalizedUsername) return false;
  if (isGeneratedHandle(normalized)) return false;
  return true;
}

export function resolveDisplayName(
  source: DisplayNameSource,
  fallback = "익명",
) {
  if (isUsablePublicName(source.nickname, source.username)) {
    return normalizeText(source.nickname);
  }

  if (isUsablePublicName(source.displayName, source.username)) {
    return normalizeText(source.displayName);
  }

  if (isUsablePublicName(source.name, source.username)) {
    return normalizeText(source.name);
  }

  const username = normalizeText(source.username);
  if (username) return username;
  return fallback;
}

export function needsNicknameOnboarding(source: DisplayNameSource) {
  const nickname = normalizeText(source.nickname);
  const displayName = normalizeText(source.displayName);
  const username = normalizeText(source.username);

  if (nickname) {
    return nickname === username || isGeneratedHandle(nickname);
  }

  if (displayName) {
    return displayName === username || isGeneratedHandle(displayName);
  }

  return true;
}
