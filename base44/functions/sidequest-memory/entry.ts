import { createClientFromRequest } from "npm:@base44/sdk";

import {
  ingestExperienceMemory,
  type MemoryImageInput,
  MemoryPipelineError,
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

async function ensureSidequestUser(base44: Row, viewer: Row) {
  const users = base44.asServiceRole.entities.SidequestUser;
  const rows = await users.filter(
    { auth_user_id: viewer.id },
    undefined,
    1,
  );
  const existing = rows[0];
  if (existing) {
    const patch: Row = {};
    if (viewer.email && existing.email !== viewer.email) {
      patch.email = viewer.email;
    }
    if (viewer.full_name && !existing.name) {
      patch.name = viewer.full_name;
    }
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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const viewer = await base44.auth.me().catch(() => null);
    if (!viewer) {
      return Response.json(
        {
          error: "Your session expired. Sign in again, then retry your draft.",
          code: "AUTHENTICATION_REQUIRED",
        },
        { status: 401 },
      );
    }

    const input = (await req.json()) as Record<string, unknown>;
    if (input.action !== "create") {
      return Response.json(
        { error: "Unknown memory action.", code: "MEMORY_INPUT_INVALID" },
        { status: 400 },
      );
    }

    const clientRequestId = requestId(input.clientRequestId);
    if (!clientRequestId) {
      return Response.json(
        {
          error: "A valid memory request id is required.",
          code: "MEMORY_INPUT_INVALID",
        },
        { status: 400 },
      );
    }

    const text = textValue(input.text, MAX_TEXT_LENGTH);
    const images = validatedImages(input.images);
    if (!text && images.length === 0) {
      return Response.json(
        {
          error: "A memory needs text or at least one image.",
          code: "MEMORY_INPUT_INVALID",
        },
        { status: 400 },
      );
    }

    const source = input.source === "reflection" ? "reflection" : "onboarding";
    const user = await ensureSidequestUser(base44, viewer);
    const result = await ingestExperienceMemory(base44, {
      user,
      phone: stringValue(user.phone, 30),
      authUserId: viewer.id,
      source,
      clientRequestId,
      text,
      images,
    });

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

    return Response.json({ value: result });
  } catch (error) {
    const status =
      error instanceof MemoryPipelineError ? error.status : 500;
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
