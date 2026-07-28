import { describe, expect, it } from "vitest";

import { Base44FunctionError } from "./base44Functions";
import { isUndeployedBase44Action } from "./backendCompatibility";

describe("isUndeployedBase44Action", () => {
  it("recognises the older function's unknown-action response", () => {
    expect(
      isUndeployedBase44Action(
        new Base44FunctionError("400 unknown action", 400),
      ),
    ).toBe(true);
  });

  it("does not hide unrelated backend failures", () => {
    expect(
      isUndeployedBase44Action(new Base44FunctionError("bad request", 400)),
    ).toBe(false);
    expect(
      isUndeployedBase44Action(
        new Base44FunctionError("unknown action", 500),
      ),
    ).toBe(false);
  });
});
