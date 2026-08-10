export function normalizeImessageHandle(value: string) {
  const normalized = value.trim().toLocaleLowerCase();
  const withoutScheme = normalized.startsWith("tel:")
    ? normalized.slice(4)
    : normalized;

  if (withoutScheme.includes("@")) return withoutScheme;
  return withoutScheme.replace(/[\s().-]/g, "");
}

export function isAllowedImessageHandle(
  handle: string,
  configuredAllowlist = process.env.CHAPTER_TEST_IMESSAGE_HANDLE,
) {
  if (!configuredAllowlist) return false;
  const normalizedHandle = normalizeImessageHandle(handle);
  return configuredAllowlist
    .split(",")
    .map(normalizeImessageHandle)
    .some((allowed) => allowed.length > 0 && allowed === normalizedHandle);
}
