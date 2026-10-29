import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { AccountNav } from "@/components/auth/account-nav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "fitcheck",
  description: "Check if a piece works with your closet before you buy it.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="border-b border-black/10 dark:border-white/15">
          <nav className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3 text-sm">
            <Link href="/" className="font-semibold">
              fitcheck
            </Link>
            <span aria-hidden="true" className="text-foreground/40">
              ·
            </span>
            <Link href="/closet" className="hover:underline">
              Closet
            </Link>
            <Link href="/profile" className="ml-auto hover:underline">
              Profile
            </Link>
            <Suspense>
              <AccountNav />
            </Suspense>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
