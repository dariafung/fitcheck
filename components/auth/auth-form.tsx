"use client";

import { useActionState } from "react";
import { logIn, signUp, tryDemo, type AuthFormState } from "@/lib/auth/actions";
import { AUTH_ERRORS, MIN_PASSWORD_LENGTH } from "@/lib/auth/messages";

const INPUT =
  "w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 outline-none focus:border-foreground dark:border-white/20";
const LABEL = "text-sm text-foreground/70";
const ERROR = "text-sm text-red-600 dark:text-red-400";

const MODES = {
  login: { action: logIn, submit: "Log in", busy: "Logging in…", password: "current-password" },
  signup: { action: signUp, submit: "Create account", busy: "Creating…", password: "new-password" },
} as const;

export function AuthForm({ mode }: { mode: keyof typeof MODES }) {
  const { action, submit, busy, password } = MODES[mode];
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(action, {});

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className={LABEL}>
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.email}
          className={INPUT}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className={LABEL}>
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={password}
          required
          minLength={mode === "signup" ? MIN_PASSWORD_LENGTH : undefined}
          className={INPUT}
        />
        {mode === "signup" && (
          <p className="text-xs text-foreground/50">At least {MIN_PASSWORD_LENGTH} characters.</p>
        )}
      </div>
      {state.error && (
        <p role="alert" className={ERROR}>
          {AUTH_ERRORS[state.error]}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background disabled:opacity-40"
      >
        {pending ? busy : submit}
      </button>
    </form>
  );
}

export function DemoButton() {
  const [state, formAction, pending] = useActionState<AuthFormState>(tryDemo, {});
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <button
        type="submit"
        disabled={pending}
        className="rounded-full border border-black/15 px-5 py-2 text-sm font-medium disabled:opacity-40 dark:border-white/20"
      >
        {pending ? "Opening…" : "Try the demo account"}
      </button>
      <p className="text-center text-xs text-foreground/50">A sample closet to look around. Read-only.</p>
      {state.error && (
        <p role="alert" className={ERROR}>
          {AUTH_ERRORS[state.error]}
        </p>
      )}
    </form>
  );
}
