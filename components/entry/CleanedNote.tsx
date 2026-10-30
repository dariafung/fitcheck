// Under a photo the model cut out: says so, and lets the user keep the
// original instead before saving.
export function CleanedNote({ onUseOriginal, disabled }: { onUseOriginal: () => void; disabled?: boolean }) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-ink-2">
      Photo cleaned up by AI.
      <button type="button" onClick={onUseOriginal} disabled={disabled} className="btn-text">
        Use original photo
      </button>
    </p>
  );
}
