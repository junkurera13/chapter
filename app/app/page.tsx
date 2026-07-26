import AuthGate from "./AuthGate";

export default async function ChapterAppPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const { view } = await searchParams;
  const initialTab = view === "together" ? 2 : view === "now" ? 1 : 0;
  return <AuthGate initialTab={initialTab} />;
}
