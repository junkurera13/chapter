import { NowRequestError } from "./nowClient";

/**
 * Where the one first experience an account is owed has got to, as far as
 * anything on screen can tell.
 *
 * "writing" covers the ask and the model call behind it, which is most of the
 * wait and all of the part before a chapter exists to read. Nothing else on
 * Now knows that stretch is happening, so this is what says so.
 */
export type FirstExperienceWatch = {
  /**
   * Which ask this belongs to. A later ask restarts a wait an earlier one gave
   * up on, and answers to an ask that has been overtaken are ignored.
   */
  attempt: number;
  status: "idle" | "writing" | "failed";
};

/** How a wait ended: the chapter turned up, or it never did. */
export type FirstExperienceOutcome = "found" | "gaveUp";

export type FirstExperienceEvent =
  /** Somebody asked, by sending a first memory or by giving a location. */
  | { kind: "asked"; attempt: number }
  /** The route said nothing is owed, so nobody is waiting on anything. */
  | { kind: "refused"; attempt: number }
  /** The ask itself went wrong, so nothing is coming unless it is asked again. */
  | { kind: "failed"; attempt: number }
  /** The screen watching for the chapter has stopped, one way or the other. */
  | { kind: "settled"; outcome: FirstExperienceOutcome };

export const NO_FIRST_EXPERIENCE_WATCH: FirstExperienceWatch = {
  attempt: 0,
  status: "idle",
};

/**
 * A 409 is the route saying nothing is owed: no memory yet, no location yet,
 * or a chapter already holding the floor. It is not a failure anyone needs
 * telling about, but it does mean the screen must stop saying one is coming.
 */
export function isFirstExperienceRefusal(error: unknown) {
  return error instanceof NowRequestError && error.status === 409;
}

export function firstExperienceWatch(
  current: FirstExperienceWatch,
  event: FirstExperienceEvent,
): FirstExperienceWatch {
  if (event.kind === "asked") {
    return { attempt: event.attempt, status: "writing" };
  }

  if (event.kind === "settled") {
    // Only a wait still in progress can end. A watch already settled, or one
    // belonging to an ask that has since been replaced, stays as it is.
    if (current.status !== "writing") return current;
    return {
      ...current,
      status: event.outcome === "found" ? "idle" : "failed",
    };
  }

  // An answer to an ask that has already been overtaken says nothing about the
  // one now running.
  if (current.attempt !== event.attempt) return current;
  return {
    attempt: event.attempt,
    status: event.kind === "refused" ? "idle" : "failed",
  };
}
