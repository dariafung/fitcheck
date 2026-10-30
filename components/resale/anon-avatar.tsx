// An anonymous buyer: a colored circle with a plain figure, nothing that
// tells who they are.
export function AnonAvatar({ color, label }: { color: string; label: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      className="inline-flex size-10 shrink-0 items-center justify-center rounded-full"
      style={{ background: color }}
    >
      <svg viewBox="0 0 24 24" aria-hidden className="size-5 fill-paper">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0z" />
      </svg>
    </span>
  );
}
