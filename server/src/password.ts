import bcrypt from "bcryptjs";

// bcrypt work factor, read from the environment so it can be raised without a code
// change (D-02). Ten is the common floor and keeps the test suite fast.
export const BCRYPT_COST = Number(process.env.BCRYPT_COST) || 10;

export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;

// A short, documented blocklist of trivial passwords that clear the length rule
// but are obviously guessable (BR-10, D-09). NIST SP 800-63B favours length plus a
// known-bad list over composition rules. Compared case-insensitively.
export const PASSWORD_BLOCKLIST = [
  "password1234",
  "passwordpassword",
  "123456789012",
  "1234567890123",
  "qwertyuiop12",
  "changeme1234",
  "letmein12345",
  "welcome123456",
  "adminadmin12",
  "toktickit123",
];

// A valid bcrypt hash of a random value. Login compares an unknown email against
// this so the unknown-email and wrong-password paths take comparable time and
// cannot be told apart by timing (api-spec §2.1).
export const DUMMY_HASH = bcrypt.hashSync("timing-equalizer-not-a-real-password", BCRYPT_COST);

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  // bcryptjs returns false (never throws) for a malformed/empty hash, so a
  // migrated row with an unusable hash simply cannot authenticate (BR-01).
  return bcrypt.compare(plain, hash);
}

// Trim and lower-case for storage and comparison (BR-12).
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Validates a candidate new password against BR-10. Returns a field message, or
 * null when acceptable. `currentPassword` is optional so the same rule serves the
 * admin initial-password path, which has no "current" to differ from.
 */
export function validateNewPassword(
  newPassword: unknown,
  currentPassword?: string
): string | null {
  if (typeof newPassword !== "string" || newPassword.length < PASSWORD_MIN || newPassword.length > PASSWORD_MAX) {
    return `Password must be ${PASSWORD_MIN}–${PASSWORD_MAX} characters.`;
  }
  if (currentPassword !== undefined && newPassword === currentPassword) {
    return "New password must differ from the current password.";
  }
  if (PASSWORD_BLOCKLIST.includes(newPassword.toLowerCase())) {
    return "That password is too common. Choose a less predictable one.";
  }
  return null;
}
