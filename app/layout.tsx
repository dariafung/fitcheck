import type { Metadata } from "next";
import { Newsreader, Schibsted_Grotesk } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { AccountNav } from "@/components/auth/account-nav";
import { CalendarNavLink } from "@/components/calendar/calendar-nav-link";
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

// 44px tall to tap, though the header still reads as one thin line.
const NAV_LINK = "inline-flex h-11 items-center text-sm text-ink transition-colors duration-150 hover:text-ink-2";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${schibsted.variable} ${newsreader.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-paper text-ink">
        <header className="border-b border-line">
          {/* Logo, sections and the purchase check on the left; the account on the right. */}
          <nav className="shell flex h-14 items-center gap-4 md:gap-5">
            <Link href="/" className="mr-1 text-sm font-medium tracking-[0.25em] uppercase md:mr-3">
              fitcheck
            </Link>
            <Link href="/closet" className={NAV_LINK}>
              Closet
            </Link>
            <Suspense>
              <CalendarNavLink className={NAV_LINK} />
            </Suspense>
            {/* The one filled button in the bar: it's what the app is for. A
                phone has room for one word. */}
            <Link
              href="/check"
              className="inline-flex h-9 items-center bg-ink px-3 text-[13px] font-medium whitespace-nowrap text-paper transition-colors duration-150 ease-quiet hover:bg-press md:px-4"
            >
              <span className="md:hidden">Buy?</span>
              <span className="hidden md:inline">Should I buy this?</span>
            </Link>
            <div className="ml-auto flex items-center gap-4 text-sm md:gap-5">
              <Link href="/profile" className={NAV_LINK}>
                Profile
              </Link>
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
