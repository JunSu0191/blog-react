type SocialSignupSource = {
  username?: string | null;
  name?: string | null;
  email?: string | null;
};

const USERNAME_ALLOWED_PATTERN = /^[a-z0-9._-]{4,30}$/;

function normalizeText(value?: string | null) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function sanitizeUsernameCandidate(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/@.*$/, "")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/[._-]{2,}/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 30);

  return normalized;
}

export function validateUsernamePolicy(value: string) {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) {
    return { valid: false, message: "아이디를 입력해 주세요." };
  }

  if (!USERNAME_ALLOWED_PATTERN.test(normalized)) {
    return {
      valid: false,
      message:
        "아이디는 4~30자의 영문 소문자, 숫자, 마침표(.), 밑줄(_), 하이픈(-)만 사용할 수 있습니다.",
    };
  }

  return { valid: true };
}

export function suggestUsernameCandidate(source: SocialSignupSource) {
  const email = normalizeText(source.email);
  if (email.includes("@")) {
    const fromEmail = sanitizeUsernameCandidate(email);
    if (fromEmail) return fromEmail;
  }

  const name = normalizeText(source.name);
  if (name) {
    const fromName = sanitizeUsernameCandidate(name);
    if (fromName) return fromName;
  }

  const username = normalizeText(source.username);
  if (username) {
    const fromUsername = sanitizeUsernameCandidate(username);
    if (fromUsername) return fromUsername;
  }

  return "";
}
