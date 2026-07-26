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
  reuploadImages: boolean;
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
        serverMessage ||
        "One of those photos needs to be uploaded again. Your draft and contexts are still here.",
      reuploadImages: true,
      requiresAuthentication: false,
    };
  }

  if (code === "AUTHENTICATION_REQUIRED" || status === 401 || status === 403) {
    return {
      message:
        "Your session expired. Sign in in a new tab, then come back and retry—this draft will stay here.",
      reuploadImages: false,
      requiresAuthentication: true,
    };
  }

  if (code === "MEMORY_IN_PROGRESS" || status === 409) {
    return {
      message: "Chapter is still working on this memory. Give it a moment, then retry.",
      reuploadImages: false,
      requiresAuthentication: false,
    };
  }

  if (code === "MEMORY_INPUT_INVALID" && serverMessage) {
    return {
      message: serverMessage,
      reuploadImages: false,
      requiresAuthentication: false,
    };
  }

  if (status === 413) {
    return {
      message: "One of those photos is too large to upload. Remove it and try again.",
      reuploadImages: true,
      requiresAuthentication: false,
    };
  }

  return {
    message:
      "Chapter couldn’t finish that memory just now. Your draft and photos are still here—try again.",
    reuploadImages: false,
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
  const response = await fetch("/api/memory", {
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
  });
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
