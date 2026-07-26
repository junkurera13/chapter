import type { Metadata } from "next";

import InviteAcceptance from "./InviteAcceptance";

export const metadata: Metadata = {
  title: "A Chapter invitation",
  description: "Connect with someone you know on Chapter.",
};

export default async function ConnectionInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <InviteAcceptance token={token} />;
}
