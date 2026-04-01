export const LIMITS = {
  displayName: 40,
  bio: 280,
  homepark: 80,
  avatarUrl: 500,
  notes: 500,
} as const;

export function validateDisplayName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Display name is required");
  }
  if (trimmed.length > LIMITS.displayName) {
    throw new Error(`Display name must be ${LIMITS.displayName} characters or fewer`);
  }
  return trimmed;
}

export function validateOptionalText(
  value: string | undefined,
  fieldName: string,
  maxLength: number,
) {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > maxLength) {
    throw new Error(`${fieldName} must be ${maxLength} characters or fewer`);
  }
  return trimmed;
}

export function validateAvatarUrl(value: string | undefined) {
  const trimmed = validateOptionalText(value, "Avatar URL", LIMITS.avatarUrl);
  if (!trimmed) return undefined;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("Avatar URL must be a valid URL");
  }

  if (url.protocol !== "https:") {
    throw new Error("Avatar URL must use https");
  }

  return url.toString();
}
