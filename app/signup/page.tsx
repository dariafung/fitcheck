import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm, DemoButton } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Sign up · fitcheck" };

export default function SignupPage() {
  return (
    <div className="mx-auto flex w-full max-w-[360px] flex-col gap-10 md:pt-10">
      <div className="flex flex-col gap-3">
        <h1 className="text-xl font-medium">Sign up</h1>
        <p className="text-base text-ink-2">Start with an empty closet and add what you own.</p>
      </div>
      <AuthForm mode="signup" />
      <p className="text-sm text-ink-2">
        Have an account?{" "}
        <Link href="/login" className="py-3.5 font-medium text-ink underline underline-offset-4">
          Log in
        </Link>
      </p>
      <div className="border-t border-line pt-10">
        <DemoButton />
      </div>
    </div>
  );
}
