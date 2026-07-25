import { redirect } from "next/navigation";

export default function SignupPage() {
  redirect("/?auth=1");
}
