import { after } from "next/server";

import { getSidequestBot } from "@/lib/sidequestBot";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    return await getSidequestBot().webhooks.imessage(request, {
      waitUntil: (task) => after(() => task),
    });
  } catch (error) {
    console.error("iMessage webhook setup failed", error);
    return new Response("iMessage webhook is not configured", { status: 503 });
  }
}

export function GET() {
  return Response.json({
    service: "chapter-imessage",
    configured: Boolean(
      (process.env.IMESSAGE_PROJECT_ID || process.env.PHOTON_PROJECT_ID) &&
        (process.env.IMESSAGE_PROJECT_SECRET || process.env.PHOTON_PROJECT_SECRET) &&
        process.env.IMESSAGE_WEBHOOK_SECRET &&
        process.env.SIDEQUEST_INTERNAL_SECRET,
    ),
  });
}
