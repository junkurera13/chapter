import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { z } from "zod";

import { weeklyPackDesignArtifactSchema } from "./weeklyPackDesign";
import {
  weeklyPackResearchResultSchema,
  weeklyPackResearchRunsSchema,
} from "./weeklyPackGeneration";

const REVIEW_JOB_TTL_MS = 45 * 60 * 1_000;

export const weeklyPackReviewJobSchema = z.object({
  version: z.literal(1),
  accessTokenHash: z.string().regex(/^[a-f0-9]{64}$/),
  requestId: z.string().trim().min(1).max(160),
  createdAt: z.number().int().positive(),
  weekKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  artifact: weeklyPackDesignArtifactSchema,
  runs: weeklyPackResearchRunsSchema,
  research: z.array(weeklyPackResearchResultSchema).length(3).optional(),
});

export type WeeklyPackReviewJob = z.infer<
  typeof weeklyPackReviewJobSchema
>;

export function weeklyPackAccessTokenHash(accessToken: string) {
  return createHash("sha256").update(accessToken).digest("hex");
}

function encryptionKey(secret: string) {
  return createHash("sha256").update(secret).digest();
}

export function sealWeeklyPackReviewJob(
  job: WeeklyPackReviewJob,
  secret: string,
) {
  const plaintext = Buffer.from(
    JSON.stringify(weeklyPackReviewJobSchema.parse(job)),
  );
  const initializationVector = randomBytes(12);
  const cipher = createCipheriv(
    "aes-256-gcm",
    encryptionKey(secret),
    initializationVector,
  );
  const ciphertext = Buffer.concat([
    cipher.update(plaintext),
    cipher.final(),
  ]);
  const authenticationTag = cipher.getAuthTag();
  return [
    initializationVector.toString("base64url"),
    ciphertext.toString("base64url"),
    authenticationTag.toString("base64url"),
  ].join(".");
}

export function openWeeklyPackReviewJob(args: {
  token: string;
  secret: string;
  now?: number;
}) {
  const [encodedVector, encodedCiphertext, encodedTag, extra] =
    args.token.split(".");
  if (!encodedVector || !encodedCiphertext || !encodedTag || extra) {
    throw new Error("That generator session is invalid.");
  }

  let plaintext: Buffer;
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey(args.secret),
      Buffer.from(encodedVector, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
    plaintext = Buffer.concat([
      decipher.update(Buffer.from(encodedCiphertext, "base64url")),
      decipher.final(),
    ]);
  } catch {
    throw new Error("That generator session is invalid.");
  }

  let raw: unknown;
  try {
    raw = JSON.parse(plaintext.toString("utf8"));
  } catch {
    throw new Error("That generator session is invalid.");
  }

  const job = weeklyPackReviewJobSchema.parse(raw);
  const now = args.now ?? Date.now();
  if (
    job.createdAt > now + 60_000 ||
    now - job.createdAt > REVIEW_JOB_TTL_MS
  ) {
    throw new Error("That generator session expired. Start a fresh one.");
  }
  return job;
}
