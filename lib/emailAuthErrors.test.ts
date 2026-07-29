import { describe, expect, it } from "vitest";
import { Base44Error } from "@base44/sdk";

import {
  authErrorMessage,
  authErrorStatus,
  isBadCredentialsError,
  isExistingAccountError,
  isUnverifiedAccountError,
} from "./emailAuthErrors";

/** What Base44 actually answers when the email is already registered. */
function duplicateEmailError() {
  return new Base44Error(
    "A user with this email already exists",
    400,
    "HTTPException",
    {
      error_type: "HTTPException",
      message: "A user with this email already exists",
      detail: "A user with this email already exists",
    },
    undefined,
  );
}

describe("authErrorStatus", () => {
  it("reads the status off a Base44 error", () => {
    expect(authErrorStatus(duplicateEmailError())).toBe(400);
  });

  it("reads the status off a raw axios-shaped error", () => {
    expect(authErrorStatus({ response: { status: 403 } })).toBe(403);
  });

  it("is undefined when the request never reached Base44", () => {
    expect(authErrorStatus(new Error("Network Error"))).toBeUndefined();
    expect(authErrorStatus({ response: { status: "nope" } })).toBeUndefined();
  });
});

describe("authErrorMessage", () => {
  it("prefers what Base44 said", () => {
    expect(authErrorMessage(duplicateEmailError())).toBe(
      "A user with this email already exists",
    );
  });

  it("falls back to detail when there is no message", () => {
    expect(
      authErrorMessage({ response: { data: { detail: "Password too short" } } }),
    ).toBe("Password too short");
  });

  it("has something to say for a bare failure", () => {
    expect(authErrorMessage(undefined)).toBe("Something went wrong. Try again.");
  });
});

describe("isExistingAccountError", () => {
  it("recognizes the 400 Base44 sends for an account that already exists", () => {
    expect(isExistingAccountError(duplicateEmailError())).toBe(true);
  });

  it("still recognizes a plain 409", () => {
    expect(isExistingAccountError({ response: { status: 409 } })).toBe(true);
  });

  it.each([
    "A user with this email already exists",
    "Email already registered",
    "That email is already taken",
  ])("recognizes the wording variants (%s)", (detail) => {
    expect(isExistingAccountError({ response: { status: 400, data: { detail } } })).toBe(
      true,
    );
  });

  it("leaves other registration failures alone", () => {
    expect(
      isExistingAccountError({
        response: { status: 400, data: { detail: "Password is too short" } },
      }),
    ).toBe(false);
    expect(isExistingAccountError({ response: { status: 500 } })).toBe(false);
    expect(isExistingAccountError(new Error("Network Error"))).toBe(false);
  });
});

describe("isBadCredentialsError", () => {
  it("recognizes the 400 Base44 sends for a wrong password", () => {
    expect(
      isBadCredentialsError({
        response: { status: 400, data: { detail: "Invalid email or password" } },
      }),
    ).toBe(true);
  });

  it("still recognizes a plain 401", () => {
    expect(isBadCredentialsError({ response: { status: 401 } })).toBe(true);
  });

  it("does not mistake an existing account for a wrong password", () => {
    expect(isBadCredentialsError(duplicateEmailError())).toBe(false);
  });

  it("leaves unrelated failures alone", () => {
    expect(isBadCredentialsError({ response: { status: 500 } })).toBe(false);
    expect(isBadCredentialsError(new Error("Network Error"))).toBe(false);
  });
});

describe("isUnverifiedAccountError", () => {
  it.each([
    "Email not verified",
    "This account is unverified",
    "Please verify your email before signing in",
  ])("recognizes an account that never finished verifying (%s)", (detail) => {
    expect(
      isUnverifiedAccountError({ response: { status: 400, data: { detail } } }),
    ).toBe(true);
  });

  it("still recognizes a plain 403", () => {
    expect(isUnverifiedAccountError({ response: { status: 403 } })).toBe(true);
  });

  it("does not mistake a wrong password for an unverified account", () => {
    expect(
      isUnverifiedAccountError({
        response: { status: 400, data: { detail: "Invalid email or password" } },
      }),
    ).toBe(false);
  });
});
