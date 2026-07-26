import { getBase44BrowserClient } from "./base44BrowserClient";

const IMAGE_MEDIA_TYPES_BY_EXTENSION: Record<string, string> = {
  avif: "image/avif",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export type UploadedMemoryPhoto = {
  fileUri: string;
  fileName: string;
  mediaType: string;
  byteSize: number;
  context: string;
};

export type CreatedExperienceMemory = {
  memoryId: string;
  title: string;
  summary: string;
  created: boolean;
};

function mediaTypeFor(file: File) {
  if (file.type.startsWith("image/")) return file.type.toLocaleLowerCase("en");
  const extension = file.name.split(".").pop()?.toLocaleLowerCase("en") ?? "";
  return IMAGE_MEDIA_TYPES_BY_EXTENSION[extension] ?? "";
}

export function validateMemoryPhoto(file: File) {
  if (!mediaTypeFor(file)) {
    throw new Error(`${file.name} is not a supported image.`);
  }
  if (file.size <= 0 || file.size > 25 * 1024 * 1024) {
    throw new Error(`${file.name} must be smaller than 25 MB.`);
  }
}

export async function uploadMemoryPhoto(
  file: File,
  context: string,
): Promise<UploadedMemoryPhoto> {
  validateMemoryPhoto(file);
  const client = getBase44BrowserClient();
  const result = await client.integrations.Core.UploadPrivateFile({ file });
  if (!result.file_uri) {
    throw new Error(`${file.name} could not be uploaded.`);
  }

  return {
    fileUri: result.file_uri,
    fileName: file.name,
    mediaType: mediaTypeFor(file),
    byteSize: file.size,
    context: context.trim(),
  };
}

export async function createExperienceMemory({
  clientRequestId,
  text,
  images,
  source = "onboarding",
}: {
  clientRequestId: string;
  text: string;
  images: UploadedMemoryPhoto[];
  source?: "onboarding" | "reflection";
}) {
  const client = getBase44BrowserClient();
  const response = await client.functions.invoke("sidequest-memory", {
    action: "create",
    clientRequestId,
    source,
    text: text.trim(),
    images,
  });

  return (response.data as { value: CreatedExperienceMemory }).value;
}
