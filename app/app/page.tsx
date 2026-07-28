import AuthGate from "./AuthGate";

export default async function ChapterAppPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string | string[];
    joined?: string | string[];
    pack?: string | string[];
  }>;
}) {
  const { view, joined, pack } = await searchParams;
  const initialTab = view === "together" ? 2 : view === "now" ? 1 : 0;
  const packValue = Array.isArray(pack) ? pack[0] : pack;
  const weeklyPackPreview =
    packValue === "locked"
      ? "locked"
      : packValue === "chosen"
        ? "chosen"
        : packValue === "preview"
          ? "available"
          : undefined;
  return (
    <AuthGate
      initialTab={initialTab}
      justConnected={joined === "1" || (Array.isArray(joined) && joined.includes("1"))}
      weeklyPackPreview={weeklyPackPreview}
    />
  );
}
