import { httpRouter } from "convex/server";

import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import type { ChapterExperienceValue } from "./chapterValidators";

const http = httpRouter();

function constantTimeEqual(left: string, right: string) {
  const length = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;

  for (let index = 0; index < length; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }

  return mismatch === 0;
}

function isAuthorized(request: Request) {
  const secret = process.env.CHAPTER_AGENT_SECRET;
  if (!secret) return false;
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return false;
  return constantTimeEqual(secret, authorization.slice("Bearer ".length));
}

function record(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected a JSON object.");
  }
  return value as Record<string, unknown>;
}

function stringField(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid ${field}.`);
  }
  return value;
}

function optionalString(value: unknown, field: string) {
  if (value === undefined) return undefined;
  return stringField(value, field);
}

http.route({
  path: "/chapter-agent",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!isAuthorized(request)) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }

    try {
      const body = record(await request.json());
      const operation = stringField(body.operation, "operation");
      const externalPrincipalId = stringField(
        body.externalPrincipalId,
        "externalPrincipalId",
      );

      switch (operation) {
        case "get_context":
          return Response.json(
            await ctx.runQuery(internal.chapterAgent.getContext, {
              externalPrincipalId,
            }),
          );
        case "save_memory":
          return Response.json(
            await ctx.runMutation(internal.chapterAgent.saveMemory, {
              externalPrincipalId,
              idempotencyKey: stringField(
                body.idempotencyKey,
                "idempotencyKey",
              ),
              text: stringField(body.text, "text"),
            }),
          );
        case "save_location":
          return Response.json(
            await ctx.runMutation(internal.chapterAgent.saveLocation, {
              externalPrincipalId,
              city: stringField(body.city, "city"),
              area: optionalString(body.area, "area"),
              country: optionalString(body.country, "country"),
            }),
          );
        case "save_experience":
          return Response.json(
            await ctx.runMutation(internal.chapterAgent.saveExperience, {
              externalPrincipalId,
              idempotencyKey: stringField(
                body.idempotencyKey,
                "idempotencyKey",
              ),
              requestText: stringField(body.requestText, "requestText"),
              experience: body.experience as ChapterExperienceValue,
            }),
          );
        case "save_feedback":
          return Response.json(
            await ctx.runMutation(internal.chapterAgent.saveFeedback, {
              externalPrincipalId,
              idempotencyKey: stringField(
                body.idempotencyKey,
                "idempotencyKey",
              ),
              experienceId: body.experienceId as
                | Id<"chapterExperiences">
                | undefined,
              verdict: body.verdict as "save" | "pass" | "done" | "note",
              text: optionalString(body.text, "text"),
            }),
          );
        default:
          return Response.json({ error: "unknown operation" }, { status: 400 });
      }
    } catch (cause) {
      console.error("Rejected a Chapter agent request.", cause);
      return Response.json({ error: "invalid request" }, { status: 400 });
    }
  }),
});

export default http;
