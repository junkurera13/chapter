import type { Metadata } from "next";

import InviteAcceptance from "./InviteAcceptance";

export const metadata: Metadata = {
  title: "A Sidequest invitation",
  description: "Connect your Sidequest with someone you know.",
};

export default async function ConnectionInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <InviteAcceptance token={token} />;
}
