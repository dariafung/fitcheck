import type { Metadata } from "next";
import { Newsreader, Schibsted_Grotesk } from "next/font/google";
import { Suspense } from "react";
import { AccountNav } from "@/components/auth/account-nav";
import { SignedInOnly } from "@/components/auth/signed-in-only";
import { CalendarNavLink } from "@/components/calendar/calendar-nav-link";
import { NAV_LINK } from "@/components/nav/nav-class";
import { NavLink } from "@/components/nav/nav-link";
import "./globals.css";

// Interface, headings and numbers: a news grotesque with a little more
// character than the usual neutral sans.
const schibsted = Schibsted_Grotesk({
  variable: "--font-schibsted",
  subsets: ["latin"],
});

// Upright only. Carries the one-line verdicts and the user's own words.
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: "normal",
  axes: ["opsz"],
});

export const metadata: Metadata = {
  title: "fitcheck",
  description: "Check if a piece works with your closet before you buy it.",
};

// Signed out (sign-in on), the top bar is only the logo and Log in. While the
// session is read, the links show as they will for almost everyone.
const CLOSET = (
  <NavLink href="/closet" className={NAV_LINK}>
    Closet
  </NavLink>
);
const PROFILE = (
  <NavLink href="/profile" className={NAV_LINK}>
    Profile
  </NavLink>
);

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${schibsted.variable} ${newsreader.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-paper text-ink">
        <header className="border-b border-line">
          {/* Logo and sections on the left; the account on the right. The
              purchase check starts from the banner on home. */}
          <nav className="shell flex h-14 items-center gap-4 md:gap-5">
            <NavLink href="/" className="mr-1 text-sm font-medium tracking-[0.25em] uppercase md:mr-3">
              fitcheck
            </NavLink>
            <Suspense fallback={CLOSET}>
              <SignedInOnly>{CLOSET}</SignedInOnly>
            </Suspense>
            <Suspense>
              <CalendarNavLink className={NAV_LINK} />
            </Suspense>
            <div className="ml-auto flex items-center gap-4 text-sm md:gap-5">
              <Suspense fallback={PROFILE}>
                <SignedInOnly>{PROFILE}</SignedInOnly>
              </Suspense>
              <Suspense>
                <AccountNav />
              </Suspense>
            </div>
          </nav>
        </header>
        <main className="shell flex-1 pt-10 pb-24 md:pt-16 md:pb-[104px]">{children}</main>
      </body>
    </html>
  );
}
