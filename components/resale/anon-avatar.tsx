// An anonymous buyer: a plain gray circle with a figure. Every one looks the
// same, so nothing tells buyers apart.
export function AnonAvatar() {
  return (
    <span
      role="img"
      aria-label="Anonymous buyer"
      className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-ink-2"
    >
      <svg viewBox="0 0 24 24" aria-hidden className="size-5 fill-paper">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0z" />
      </svg>
    </span>
  );
}
