import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";
import { AuthSplitLayout } from "@/components/auth-split-layout";

export default async function LoginPage() {
  // Wenn schon eingeloggt: direkt zur App.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/");

  return (
    <AuthSplitLayout>
      <LoginForm />
    </AuthSplitLayout>
  );
}
