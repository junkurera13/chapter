import { Base44Error, getAccessToken } from "@base44/sdk";

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
const MAX_UPLOAD_EDGE = 2_048;
const IMAGE_COMPRESSION_TRIGGER_BYTES = 2 * 1024 * 1024;
const MEMORY_REQUEST_TIMEOUT_MS = 115_000;

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

export type MemorySubmissionFailure = {
  message: string;
  requiresAuthentication: boolean;
};

function recordValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function errorDetails(error: unknown) {
  if (error instanceof Base44Error) {
    return {
      status: error.status,
      data: recordValue(error.data),
    };
  }

  const value = recordValue(error);
  const response = recordValue(value.response);
  return {
    status:
      typeof value.status === "number"
        ? value.status
        : typeof response.status === "number"
          ? response.status
          : undefined,
    data: recordValue(value.data ?? response.data),
  };
}

export function describeMemorySubmissionFailure(
  error: unknown,
): MemorySubmissionFailure {
  const { status, data } = errorDetails(error);
  const code = stringValue(data.code);
  const serverMessage = stringValue(data.error);

  if (code === "IMAGE_REFERENCE_INVALID") {
    return {
      message:
        serverMessage || "One of those photos needs to be uploaded again.",
      requiresAuthentication: false,
    };
  }

  if (code === "AUTHENTICATION_REQUIRED" || status === 401 || status === 403) {
    return {
      message: "Your session expired. Sign in again, then start once more.",
      requiresAuthentication: true,
    };
  }

  if (code === "MEMORY_IN_PROGRESS" || status === 409) {
    return {
      message:
        "Chapter is still working on this memory. Start again in a moment.",
      requiresAuthentication: false,
    };
  }

  if (code === "MEMORY_TIMEOUT" || status === 504) {
    return {
      message: "Chapter took too long with that memory. Start again.",
      requiresAuthentication: false,
    };
  }

  if (code === "MEMORY_INPUT_INVALID" && serverMessage) {
    return {
      message: serverMessage,
      requiresAuthentication: false,
    };
  }

  if (status === 413) {
    return {
      message: "One of those photos was too large. Start again without it.",
      requiresAuthentication: false,
    };
  }

  return {
    message: "Chapter couldn’t finish that memory just now. Start again.",
    requiresAuthentication: false,
  };
}

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

function compressedFileName(fileName: string) {
  const stem = fileName.replace(/\.[^.]+$/, "").trim() || "memory-photo";
  return `${stem}.webp`;
}

async function compressMemoryPhoto(file: File) {
  if (
    file.size <= IMAGE_COMPRESSION_TRIGGER_BYTES ||
    file.type.toLocaleLowerCase("en") === "image/gif"
  ) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(
      1,
      MAX_UPLOAD_EDGE / Math.max(bitmap.width, bitmap.height),
    );
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return file;
    }
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/webp", 0.86);
    });
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], compressedFileName(file.name), {
      type: "image/webp",
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  }
}

export async function uploadMemoryPhoto(
  file: File,
  context: string,
): Promise<UploadedMemoryPhoto> {
  validateMemoryPhoto(file);
  const uploadFile = await compressMemoryPhoto(file);
  const client = getBase44BrowserClient();
  const result = await client.integrations.Core.UploadPrivateFile({
    file: uploadFile,
  });
  if (!result.file_uri) {
    throw new Error(`${file.name} could not be uploaded.`);
  }

  return {
    fileUri: result.file_uri,
    fileName: uploadFile.name,
    mediaType: mediaTypeFor(uploadFile),
    byteSize: uploadFile.size,
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
  const accessToken = await getAccessToken();
  if (!accessToken) {
    throw {
      status: 401,
      data: {
        code: "AUTHENTICATION_REQUIRED",
        error: "Your session expired.",
      },
    };
  }
  const controller = new AbortController();
  let reachedTimeout = false;
  const timeout = window.setTimeout(() => {
    reachedTimeout = true;
    controller.abort();
  }, MEMORY_REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch("/api/memory", {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        clientRequestId,
        source,
        text: text.trim(),
        images,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (reachedTimeout) {
      throw {
        status: 504,
        data: {
          code: "MEMORY_TIMEOUT",
          error: "Chapter took too long with that memory.",
        },
      };
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
  const payload = (await response.json().catch(() => ({}))) as {
    value?: CreatedExperienceMemory;
    error?: string;
    code?: string;
  };
  if (!response.ok || !payload.value) {
    throw {
      status: response.status,
      data: {
        error: payload.error,
        code: payload.code,
      },
    };
  }
  return payload.value;
}
