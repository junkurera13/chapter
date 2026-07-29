import { Base44Error } from "@base44/sdk";

/**
 * Reading Base44's auth failures.
 *
 * The email form registers first and falls back to logging in when the account
 * is already there. Base44 answers 400 for every one of these refusals, so the
 * status code alone cannot tell an account that already exists from a wrong
 * password. What separates them is the message, which is why each check here
 * reads the body and treats the status as a hint rather than the answer.
 */

function responseBody(error: unknown): Record<string, unknown> | undefined {
  if (error instanceof Base44Error) {
    return typeof error.data === "object" && error.data
      ? (error.data as Record<string, unknown>)
      : undefined;
  }
  if (error && typeof error === "object" && "response" in error) {
    const response = (error as { response?: unknown }).response;
    if (response && typeof response === "object" && "data" in response) {
      const data = (response as { data?: unknown }).data;
      return typeof data === "object" && data
        ? (data as Record<string, unknown>)
        : undefined;
    }
  }
  return undefined;
}

export function authErrorStatus(error: unknown) {
  if (error instanceof Base44Error) return error.status;
  if (error && typeof error === "object" && "response" in error) {
    const response = (error as { response?: unknown }).response;
    if (response && typeof response === "object" && "status" in response) {
      const status = Number((response as { status?: unknown }).status);
      return Number.isFinite(status) ? status : undefined;
    }
  }
  return undefined;
}

export function authErrorMessage(error: unknown) {
  const body = responseBody(error);
  for (const key of ["message", "detail"]) {
    const value = body?.[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Something went wrong. Try again.";
}

function matches(error: unknown, pattern: RegExp) {
  const body = responseBody(error);
  const texts = [
    body?.message,
    body?.detail,
    error instanceof Error ? error.message : undefined,
  ];
  return texts.some((text) => typeof text === "string" && pattern.test(text));
}

const EXISTING_ACCOUNT = /already\s+(exists|registered|in use|taken)/i;
const BAD_CREDENTIALS =
  /invalid\s+(email|credentials|password)|incorrect\s+password|wrong\s+password/i;
const UNVERIFIED_ACCOUNT = /not\s+verified|unverified|verify\s+your\s+email/i;

/**
 * True when a failed registration means "that account is already yours", which
 * is the cue to log in instead of showing the failure.
 */
export function isExistingAccountError(error: unknown) {
  if (authErrorStatus(error) === 409) return true;
  return matches(error, EXISTING_ACCOUNT);
}

/** True when the account is real but the password given for it is not. */
export function isBadCredentialsError(error: unknown) {
  if (authErrorStatus(error) === 401) return true;
  return matches(error, BAD_CREDENTIALS);
}

/**
 * True when the account exists but never finished email verification, which
 * sends the form back to the code screen rather than to an error.
 */
export function isUnverifiedAccountError(error: unknown) {
  if (authErrorStatus(error) === 403) return true;
  return matches(error, UNVERIFIED_ACCOUNT);
}
