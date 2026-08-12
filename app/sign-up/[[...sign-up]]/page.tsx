import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { ChapterMark } from "@/components/ChapterMark";
import styles from "../../auth.module.css";

export default function SignUpPage() {
  return (
    <main className={styles.page}>
      <Link href="/" className={styles.home} aria-label="Chapter home">
        <ChapterMark />
      </Link>
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        appearance={{
          variables: {
            colorPrimary: "#171615",
            colorForeground: "#24211e",
            colorMutedForeground: "#706a64",
            colorBackground: "#ffffff",
            colorInput: "#ffffff",
            colorInputForeground: "#24211e",
            borderRadius: "16px",
            fontFamily: "var(--font-chapter-sans), system-ui, sans-serif",
          },
          elements: {
            rootBox: styles.authRoot,
            cardBox: styles.authCardBox,
            card: styles.authCard,
            headerTitle: styles.authTitle,
            headerSubtitle: styles.authSubtitle,
            socialButtonsBlockButton: styles.socialButton,
            formButtonPrimary: styles.primaryButton,
            formFieldInput: styles.input,
            footer: styles.authFooter,
          },
        }}
      />
    </main>
  );
}
