import type { Metadata } from "next";
import { Newsreader, Schibsted_Grotesk } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { AccountNav } from "@/components/auth/account-nav";
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
          {/* Phone: logo left, links right. Desktop: logo centred between the links. */}
          <nav className="shell flex h-14 items-center gap-5 md:grid md:grid-cols-[1fr_auto_1fr]">
            <Link
              href="/"
              className="order-first mr-auto text-sm font-medium tracking-[0.25em] uppercase md:order-none md:col-start-2 md:row-start-1 md:mr-0 md:pl-[0.25em]"
            >
              fitcheck
            </Link>
            <Link href="/closet" className={`${NAV_LINK} md:col-start-1 md:row-start-1 md:justify-self-start`}>
              Closet
            </Link>
            <div className="flex items-center gap-5 text-sm md:col-start-3 md:row-start-1 md:justify-self-end">
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
