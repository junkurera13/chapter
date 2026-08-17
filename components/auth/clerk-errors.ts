type ClerkFieldError = { message: string; longMessage?: string } | null;

export function clerkErrorMessage(errors: {
  fields: object;
  global: { message: string; longMessage?: string }[] | null;
}) {
  const field = Object.values(
    errors.fields as Record<string, ClerkFieldError>,
  ).find(Boolean);
  return (
    field?.longMessage ||
    field?.message ||
    errors.global?.[0]?.longMessage ||
    errors.global?.[0]?.message ||
    ""
  );
}
