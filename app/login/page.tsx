import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm, DemoButton } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Log in · fitcheck" };

export default function LoginPage() {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-8">
      <h1 className="text-2xl font-semibold">Log in</h1>
      <AuthForm mode="login" />
      <p className="text-sm text-foreground/60">
        New here?{" "}
        <Link href="/signup" className="font-medium text-foreground underline">
          Sign up
        </Link>
      </p>
      <div className="border-t border-black/10 pt-8 dark:border-white/15">
        <DemoButton />
      </div>
    </div>
  );
}
