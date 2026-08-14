import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  CHAPTER_ACCESS_COOKIE_MAX_AGE,
  CHAPTER_ACCESS_COOKIE_NAME,
  createChapterAccessToken,
  verifyChapterAccessPassword,
} from "@/lib/chapter-access";

export async function POST(request: Request) {
  let password = "";

  try {
    const body: unknown = await request.json();
    if (
      body &&
      typeof body === "object" &&
      "password" in body &&
      typeof body.password === "string"
    ) {
      password = body.password;
    }
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (!(await verifyChapterAccessPassword(password))) {
    return NextResponse.json(
      { ok: false },
      {
        status: 401,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  const cookieStore = await cookies();
  cookieStore.set(CHAPTER_ACCESS_COOKIE_NAME, await createChapterAccessToken(), {
    httpOnly: true,
    maxAge: CHAPTER_ACCESS_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
