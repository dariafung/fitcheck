"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, Suspense } from "react";
import { type NavSection, navSection } from "./nav-section";

type Props = { href: NavSection; className: string; children: ReactNode };

const TONE = "transition-colors duration-150 hover:text-ink";

// A top-bar link: black on its own page (and its sub-pages), gray elsewhere.
// The path isn't known while an item page's shell is prerendered, so that
// shell shows the gray link until the real one streams in.
export function NavLink(props: Props) {
  return (
    <Suspense fallback={<Tinted {...props} current={false} />}>
      <CurrentAware {...props} />
    </Suspense>
  );
}

function CurrentAware(props: Props) {
  const current = navSection(usePathname()) === props.href;
  return <Tinted {...props} current={current} />;
}

function Tinted({ href, className, children, current }: Props & { current: boolean }) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={`${className} ${TONE} ${current ? "text-ink" : "text-ink-2"}`}
    >
      {children}
    </Link>
  );
}
