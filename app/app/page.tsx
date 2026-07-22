import AuthGate from "./AuthGate";

export default async function SidequestAppPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const { view } = await searchParams;
  return <AuthGate initialTab={view === "together" ? 2 : 1} />;
}
