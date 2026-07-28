import { Base44FunctionError } from "./base44Functions";

/** A local caller is ahead of the explicitly deployed Base44 function. */
export function isUndeployedBase44Action(error: unknown) {
  return (
    error instanceof Base44FunctionError &&
    error.status === 400 &&
    /unknown action/i.test(error.message)
  );
}
