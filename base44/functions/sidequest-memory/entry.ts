import { createClientFromRequest } from "npm:@base44/sdk";

import {
  completeExperienceMemory,
  failExperienceMemory,
  type ExperienceMemoryInput,
  type MemoryImageInput,
  MemoryPipelineError,
  prepareExperienceMemory,
} from "../../shared/memory-pipeline.ts";

// Base44 entity rows are dynamic at this SDK boundary.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

const MAX_IMAGES = 8;
const MAX_TEXT_LENGTH = 6_000;
const MAX_CONTEXT_LENGTH = 280;
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

function stringValue(value: unknown, maximum = 500) {
  return typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").slice(0, maximum)
    : "";
}

function textValue(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function requestId(value: unknown) {
  const parsed = stringValue(value, 160);
  return /^[A-Za-z0-9:_-]{8,160}$/.test(parsed) ? parsed : "";
}

function validatedImages(value: unknown): MemoryImageInput[] {
  if (!Array.isArray(value)) return [];
  if (value.length > MAX_IMAGES) {
    throw new MemoryPipelineError(
      "You can add up to 8 images.",
      400,
      "MEMORY_INPUT_INVALID",
    );
  }

  return value.map((rawValue, position) => {
    const image =
      rawValue && typeof rawValue === "object"
        ? (rawValue as Record<string, unknown>)
        : {};
    const fileUri = stringValue(image.fileUri, 500);
    const fileName = stringValue(image.fileName, 180) || `memory-${position + 1}`;
    const mediaType = stringValue(image.mediaType, 100).toLocaleLowerCase("en");
    const byteSize =
      typeof image.byteSize === "number" && Number.isFinite(image.byteSize)
        ? Math.floor(image.byteSize)
        : 0;
    const context = textValue(image.context, MAX_CONTEXT_LENGTH);

    if (!fileUri) {
      throw new MemoryPipelineError(
        `${fileName} needs to be uploaded again.`,
        422,
        "IMAGE_REFERENCE_INVALID",
      );
    }
    if (!mediaType.startsWith("image/")) {
      throw new MemoryPipelineError(
        `${fileName} is not an image.`,
        400,
        "MEMORY_INPUT_INVALID",
      );
    }
    if (byteSize <= 0 || byteSize > MAX_IMAGE_BYTES) {
      throw new MemoryPipelineError(
        `${fileName} must be smaller than 25 MB.`,
        400,
        "MEMORY_INPUT_INVALID",
      );
    }

    return {
      sourceRef: `image:${position}`,
      contextSourceRef: context ? `context:${position}` : undefined,
      fileUri,
      fileName,
      mediaType,
      byteSize,
      context,
      position,
    };
  });
}

async function ensureSidequestUser(
  base44: Row,
  input: Row,
  viewer: Row | null,
) {
  const users = base44.asServiceRole.entities.SidequestUser;
  const requestedAuthUserId = stringValue(input.authUserId, 160);
  const requestedPhone = stringValue(input.phone, 30);

  if (viewer) {
    if (requestedAuthUserId && requestedAuthUserId !== viewer.id) {
      throw new MemoryPipelineError(
        "The signed-in user does not match this memory.",
        403,
        "AUTHENTICATION_REQUIRED",
      );
    }
    const rows = await users.filter({ auth_user_id: viewer.id }, undefined, 1);
    const existing = rows[0];
    if (existing) {
      const patch: Row = {};
      if (viewer.email && existing.email !== viewer.email) patch.email = viewer.email;
      if (viewer.full_name && !existing.name) patch.name = viewer.full_name;
      if (!existing.onboarding_step) {
        patch.onboarding_step = "needs_memory_invite";
      }
      return Object.keys(patch).length > 0
        ? await users.update(existing.id, patch)
        : existing;
    }
    return await users.create({
      auth_user_id: viewer.id,
      email: viewer.email,
      name: viewer.full_name || undefined,
      first_seen_at: Date.now(),
      onboarding_step: "needs_memory_invite",
    });
  }

  if (requestedAuthUserId) {
    const rows = await users.filter(
      { auth_user_id: requestedAuthUserId },
      undefined,
      1,
    );
    if (rows[0]) return rows[0];
  }
  if (requestedPhone) {
    const rows = await users.filter({ phone: requestedPhone }, undefined, 1);
    if (rows[0]) return rows[0];
    return await users.create({
      phone: requestedPhone,
      first_seen_at: Date.now(),
      onboarding_step: "needs_memory_invite",
    });
  }
  throw new MemoryPipelineError(
    "A Sidequest user is required.",
    401,
    "AUTHENTICATION_REQUIRED",
  );
}

function pipelineInput(user: Row, input: Row): ExperienceMemoryInput {
  return {
    user,
    phone: stringValue(user.phone, 30),
    authUserId: stringValue(user.auth_user_id, 160),
    source: input.source === "reflection" ? "reflection" : "onboarding",
    clientRequestId: requestId(input.clientRequestId) || "completion-only",
    text: textValue(input.text, MAX_TEXT_LENGTH),
    images: validatedImages(input.images),
  };
}

async function updateUserAfterMemory(
  base44: Row,
  user: Row,
  result: { created: boolean; summary: string },
) {
  const previousNotes = textValue(user.notes, 20_000);
  await base44.asServiceRole.entities.SidequestUser.update(user.id, {
    ...(result.created
      ? {
          notes: previousNotes
            ? `${previousNotes}\n${result.summary}`
            : result.summary,
        }
      : {}),
    memory_updated_at: Date.now(),
    onboarding_step: "memory_ready",
  });
}

Deno.serve(async (req) => {
  try {
    const input = (await req.json()) as Row;
    const expectedSecret = Deno.env.get("SIDEQUEST_INTERNAL_SECRET");
    if (!expectedSecret || input.internalSecret !== expectedSecret) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }

    const base44 = createClientFromRequest(req);
    const viewer = await base44.auth.me().catch(() => null);
    const user = await ensureSidequestUser(base44, input, viewer);
    const preparedInput = pipelineInput(user, input);

    if (input.action === "prepare") {
      if (!requestId(input.clientRequestId)) {
        throw new MemoryPipelineError(
          "A valid memory request id is required.",
          400,
          "MEMORY_INPUT_INVALID",
        );
      }
      if (!preparedInput.text && preparedInput.images.length === 0) {
        throw new MemoryPipelineError(
          "A memory needs text or at least one image.",
          400,
          "MEMORY_INPUT_INVALID",
        );
      }
      const result = await prepareExperienceMemory(base44, preparedInput);
      return Response.json({ value: result });
    }

    const memoryId = stringValue(input.memoryId, 160);
    if (!memoryId) {
      throw new MemoryPipelineError(
        "A memory id is required.",
        400,
        "MEMORY_INPUT_INVALID",
      );
    }

    if (input.action === "complete") {
      const result = await completeExperienceMemory(
        base44,
        preparedInput,
        memoryId,
        input.extraction,
      );
      await updateUserAfterMemory(base44, user, result);
      return Response.json({ value: result });
    }

    if (input.action === "fail") {
      await failExperienceMemory(
        base44,
        preparedInput,
        memoryId,
        stringValue(input.error),
      );
      return Response.json({ value: { failed: true } });
    }

    throw new MemoryPipelineError(
      "Unknown memory action.",
      400,
      "MEMORY_INPUT_INVALID",
    );
  } catch (error) {
    const status = error instanceof MemoryPipelineError ? error.status : 500;
    const code =
      error instanceof MemoryPipelineError
        ? error.code
        : "MEMORY_PROCESSING_FAILED";
    const message =
      error instanceof Error ? error.message : "Memory processing failed.";
    console.error("sidequest-memory failed", error);
    return Response.json({ error: message, code }, { status });
  }
});
