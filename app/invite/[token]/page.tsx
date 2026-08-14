import { requireChapterAccess } from "@/lib/chapter-access-server";

import InviteAcceptance from "./InviteAcceptance";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  await requireChapterAccess();
  const { token } = await params;
  return <InviteAcceptance token={token} />;
}
