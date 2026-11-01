"use client";

import { useId, useRef, useState } from "react";
import { brandLabel, suggestBrands } from "@/lib/entry/brands";

// The brand box: free text, with matching brands listed while typing (the
// user's own first, then the built-in list). ↑ / ↓ move, Enter or a click
// fills one in, Esc closes the list. The user's brands load the first time
// the box takes focus; without them the built-in list still shows.
export function BrandInput({
  id,
  value,
  onChange,
  className,
  maxLength,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  className: string;
  maxLength: number;
}) {
  const listId = useId();
  const [own, setOwn] = useState<string[]>([]);
  const asked = useRef(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // In the page's one case for brands (brandLabel); that is what fills in.
  const options = open ? suggestBrands(value, own).map(brandLabel) : [];
  const shown = options.length > 0;

  function loadOwn() {
    if (asked.current) return;
    asked.current = true;
    fetch("/api/items/brands")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (Array.isArray(json?.brands)) setOwn(json.brands);
      })
      .catch(() => {});
  }

  function choose(name: string) {
    onChange(name);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) setOpen(true);
      setActive((i) => (shown ? (i + 1) % options.length : 0));
    } else if (event.key === "ArrowUp" && shown) {
      event.preventDefault();
      setActive((i) => (i <= 0 ? options.length - 1 : i - 1));
    } else if (event.key === "Enter" && shown && active >= 0) {
      // Fill in the brand instead of submitting the card.
      event.preventDefault();
      choose(options[active]);
    } else if (event.key === "Escape" && shown) {
      event.preventDefault();
      setOpen(false);
      setActive(-1);
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <input
        id={id}
        className={className}
        value={value}
        maxLength={maxLength}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={shown}
        aria-controls={listId}
        aria-activedescendant={shown && active >= 0 ? `${listId}-${active}` : undefined}
        onFocus={loadOwn}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
      />
      <ul
        id={listId}
        role="listbox"
        hidden={!shown}
        className="absolute top-full right-0 left-0 z-10 mt-1 border border-ink bg-paper py-1"
      >
        {options.map((name, i) => (
          <li
            key={name}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === active}
            // Keep focus in the box so the list doesn't close before the click lands.
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => setActive(i)}
            onClick={() => choose(name)}
            className="flex min-h-11 cursor-pointer items-center px-3 text-[16px] aria-selected:bg-tile"
          >
            {name}
          </li>
        ))}
      </ul>
    </div>
  );
}
