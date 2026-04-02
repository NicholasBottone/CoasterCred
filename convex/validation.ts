export const LIMITS = {
  displayName: 40,
  bio: 280,
  homepark: 80,
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
