const encoder = new TextEncoder();

export const CHAPTER_ACCESS_COOKIE_NAME = "chapter_access";
export const CHAPTER_ACCESS_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

const DEFAULT_CHAPTER_ACCESS_PASSWORD = "utility";
const ACCESS_TOKEN_PAYLOAD = "chapter-access:v1";

function configuredAccessPassword() {
  return (
    process.env.CHAPTER_ACCESS_PASSWORD?.trim() ||
    DEFAULT_CHAPTER_ACCESS_PASSWORD
  );
}

function configuredSigningSecret() {
  return (
    process.env.CHAPTER_ACCESS_COOKIE_SECRET?.trim() ||
    `chapter:${configuredAccessPassword()}`
  );
}

function toHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function digest(value: string) {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", encoder.encode(value)),
  );
}

export async function verifyChapterAccessPassword(
  candidate: string,
  expected = configuredAccessPassword(),
) {
  if (!candidate || candidate.length > 128) return false;

  const [candidateDigest, expectedDigest] = await Promise.all([
    digest(candidate),
    digest(expected),
  ]);
  let mismatch = candidateDigest.length ^ expectedDigest.length;

  for (let index = 0; index < candidateDigest.length; index += 1) {
    mismatch |= candidateDigest[index] ^ expectedDigest[index];
  }

  return mismatch === 0;
}

export async function createChapterAccessToken(
  signingSecret = configuredSigningSecret(),
) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(signingSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(ACCESS_TOKEN_PAYLOAD),
  );

  return `v1.${toHex(signature)}`;
}

export async function verifyChapterAccessToken(
  token: string | undefined,
  signingSecret = configuredSigningSecret(),
) {
  if (!token) return false;

  const expected = await createChapterAccessToken(signingSecret);
  return verifyChapterAccessPassword(token, expected);
}
