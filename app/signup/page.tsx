import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm, DemoButton } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Sign up · fitcheck" };

export default function SignupPage() {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Sign up</h1>
        <p className="text-sm text-foreground/60">Start with an empty closet and add what you own.</p>
      </div>
      <AuthForm mode="signup" />
      <p className="text-sm text-foreground/60">
        Have an account?{" "}
        <Link href="/login" className="font-medium text-foreground underline">
          Log in
        </Link>
      </p>
      <div className="border-t border-black/10 pt-8 dark:border-white/15">
        <DemoButton />
      </div>
    </div>
  );
}
