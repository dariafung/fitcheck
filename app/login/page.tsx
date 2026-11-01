import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm, DemoButton } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Log in · fitcheck" };

// Most visitors come to look around, so the demo account leads and logging
// in to your own closet sits under it.
export default function LoginPage() {
  return (
    <div className="mx-auto flex w-full max-w-[360px] flex-col gap-10 md:pt-10">
      <div className="flex flex-col gap-3">
        <h1 className="text-xl font-medium">Welcome to fitcheck</h1>
        <p className="text-base text-pretty text-ink-2">Check a piece against your closet before you buy it.</p>
      </div>
      <DemoButton primary />
      <p className="flex items-center gap-4 text-sm text-ink-2">
        <span aria-hidden className="h-px flex-1 bg-line" />
        Or log in
        <span aria-hidden className="h-px flex-1 bg-line" />
      </p>
      <AuthForm mode="login" />
      <p className="text-sm text-ink-2">
        New here?{" "}
        <Link href="/signup" className="font-medium text-ink underline underline-offset-4">
          Sign up
        </Link>
      </p>
    </div>
  );
}
