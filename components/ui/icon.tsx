// The site's few line icons, drawn here instead of pulled from a library:
// 24-unit canvas, 1.5 stroke (about 1px at 16px, like the hairlines), square
// ends and corners like everything else. Two sizes only: 16 beside text, 12
// for open / close marks. Always currentColor, never the signal red. Icons are
// decoration: the button around one carries the aria-label.

const PATHS = {
  "chevron-left": "M15 5l-7 7 7 7",
  "chevron-right": "M9 5l7 7-7 7",
  "chevron-down": "M5 9l7 7 7-7",
  check: "M4.5 12.5l5 5 10-11",
  plus: "M12 4v16M4 12h16",
  minus: "M4 12h16",
  close: "M5 5l14 14M19 5L5 19",
  person: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5c0-4.1 3.4-6.5 7.5-6.5s7.5 2.4 7.5 6.5",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 16, className }: { name: IconName; size?: 16 | 12; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${className ?? ""}`}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
