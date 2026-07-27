import AuthGate from "./AuthGate";

export default async function ChapterAppPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[]; joined?: string | string[] }>;
}) {
  const { view, joined } = await searchParams;
  const initialTab = view === "together" ? 2 : view === "now" ? 1 : 0;
  return (
    <AuthGate
      initialTab={initialTab}
      justConnected={joined === "1" || (Array.isArray(joined) && joined.includes("1"))}
    />
  );
}
