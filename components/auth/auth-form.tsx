"use client";

import { useActionState } from "react";
import { logIn, signUp, tryDemo, type AuthFormState } from "@/lib/auth/actions";
import { AUTH_ERROR_FIELD, AUTH_ERRORS, MIN_PASSWORD_LENGTH } from "@/lib/auth/messages";

const INPUT = "field h-11";
const LABEL = "text-sm text-ink-2";
const ERROR = "text-sm font-medium";

// On the login page the demo account is the main button, so Log in steps
// back to the secondary style.
const MODES = {
  login: { action: logIn, submit: "Log in", busy: "Logging in…", password: "current-password", button: "btn-secondary" },
  signup: { action: signUp, submit: "Create account", busy: "Creating…", password: "new-password", button: "btn-primary" },
} as const;

export function AuthForm({ mode }: { mode: keyof typeof MODES }) {
  const { action, submit, busy, password, button } = MODES[mode];
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(action, {});
  // An error about one box shows under it, in place of its hint.
  const field = state.error && AUTH_ERROR_FIELD[state.error];
  const message = state.error && AUTH_ERRORS[state.error];
  const emailBad = field === "email" || state.error === "bad_login";
  const passwordBad = field === "password";
  const hint = mode === "signup" && !passwordBad;

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
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
          aria-invalid={emailBad || undefined}
          aria-describedby={emailBad ? `${field}-error` : undefined}
          className={INPUT}
        />
        {field === "email" && (
          <p id="email-error" role="alert" className={ERROR}>
            {message}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
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
          aria-invalid={passwordBad || undefined}
          aria-describedby={passwordBad ? "password-error" : hint ? "password-hint" : undefined}
          className={INPUT}
        />
        {passwordBad && (
          <p id="password-error" role="alert" className={ERROR}>
            {message}
          </p>
        )}
        {hint && (
          <p id="password-hint" className="text-sm text-ink-2">
            At least {MIN_PASSWORD_LENGTH} characters.
          </p>
        )}
      </div>
      {state.error && !field && (
        <p role="alert" className={ERROR}>
          {message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className={`${button} mt-2 w-full`}
      >
        {pending ? busy : submit}
      </button>
    </form>
  );
}

// The main button on the login page; a secondary one under sign-up.
export function DemoButton({ primary = false }: { primary?: boolean }) {
  const [state, formAction, pending] = useActionState<AuthFormState>(tryDemo, {});
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <button
        type="submit"
        disabled={pending}
        className={`${primary ? "btn-primary" : "btn-secondary"} w-full`}
      >
        {pending ? "Opening…" : "Try the demo account"}
      </button>
      <p className="text-sm text-ink-2">A sample closet with 18 pieces. Read-only.</p>
      {state.error && (
        <p role="alert" className={ERROR}>
          {AUTH_ERRORS[state.error]}
        </p>
      )}
    </form>
  );
}
