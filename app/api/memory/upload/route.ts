import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { hasChapterAccess } from "@/lib/chapter-access-server";
import { authenticatedConvexClient } from "@/lib/convexServerClient";

export const runtime = "nodejs";
export const maxDuration = 30;

const SUPPORTED_IMAGE_TYPES = new Set([
  "image/avif",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export async function POST(request: Request) {
  if (!(await hasChapterAccess())) {
    return Response.json({ error: "Access required." }, { status: 403 });
  }
  const convex = await authenticatedConvexClient();
  if (!convex) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Choose an image to upload." }, { status: 400 });
  }
  if (
    !SUPPORTED_IMAGE_TYPES.has(file.type.toLocaleLowerCase("en")) ||
    file.size <= 0 ||
    file.size > 10 * 1024 * 1024
  ) {
    return Response.json(
      { error: "That image format or size is not supported." },
      { status: 413 },
    );
  }

  const uploadUrl = await convex.mutation(api.webMemory.generateUploadUrl, {});
  const uploaded = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!uploaded.ok) {
    return Response.json({ error: "The image could not be uploaded." }, { status: 502 });
  }
  const payload = (await uploaded.json()) as { storageId?: string };
  if (!payload.storageId) {
    return Response.json({ error: "The uploaded image is unavailable." }, { status: 502 });
  }

  const storageId = payload.storageId as Id<"_storage">;
  const fileUri = await convex.mutation(api.webMemory.registerUpload, {
    storageId,
  });
  return Response.json({
    value: {
      storageId,
      fileUri,
      fileName: file.name,
      mediaType: file.type,
      byteSize: file.size,
    },
  });
}
