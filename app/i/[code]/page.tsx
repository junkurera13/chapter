import type { Metadata } from "next";

import InviteAcceptance from "@/components/invite-acceptance";

export const metadata: Metadata = {
  title: "A Chapter invitation",
  description: "Connect with someone you know on Chapter.",
};

export default async function ConnectionInvitePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <InviteAcceptance code={code} />;
}
