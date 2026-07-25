import AuthShell from "./AuthShell";
import EmailAuthForm from "./EmailAuthForm";
import { GoogleLoginButton } from "./GoogleLoginButton";
import styles from "./page.module.css";

export default function LoginPage() {
  return (
    <AuthShell title="Enter your world.">
      <GoogleLoginButton />
      <div className={styles.divider} aria-hidden="true">or</div>
      <EmailAuthForm />
    </AuthShell>
  );
}
