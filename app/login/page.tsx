import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm, DemoButton } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Log in · fitcheck" };

export default function LoginPage() {
  return (
    <div className="mx-auto flex w-full max-w-[360px] flex-col gap-10 md:pt-10">
      <h1 className="text-xl font-medium">Log in</h1>
      <AuthForm mode="login" />
      <p className="text-sm text-ink-2">
        New here?{" "}
        <Link href="/signup" className="font-medium text-ink underline underline-offset-4">
          Sign up
        </Link>
      </p>
      <div className="border-t border-line pt-10">
        <DemoButton />
      </div>
    </div>
  );
}
