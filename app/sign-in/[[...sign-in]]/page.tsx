import ChapterAuth from "@/components/auth/ChapterAuth";
import styles from "@/components/auth/chapter-auth.module.css";
import { chapterAuthRedirect } from "@/lib/chapter-auth-redirect";
import { requireChapterAccess } from "@/lib/chapter-access-server";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  await requireChapterAccess();
  const { redirect_url } = await searchParams;

  return (
    <main className={styles.page}>
      <ChapterAuth redirectUrl={chapterAuthRedirect(redirect_url)} />
    </main>
  );
}
