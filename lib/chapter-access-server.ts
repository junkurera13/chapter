import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  CHAPTER_ACCESS_COOKIE_NAME,
  verifyChapterAccessToken,
} from "./chapter-access";

export async function hasChapterAccess() {
  if (process.env.CHAPTER_APP_OPEN === "true") return true;

  const cookieStore = await cookies();
  const token = cookieStore.get(CHAPTER_ACCESS_COOKIE_NAME)?.value;
  return verifyChapterAccessToken(token);
}

export async function requireChapterAccess() {
  if (!(await hasChapterAccess())) redirect("/?access=1");
}
