import type { SelectHTMLAttributes } from "react";
import { Icon } from "./icon";

// A native select without the browser's arrow: the site's chevron instead,
// so it matches the other line icons. Still the real control underneath.
export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select {...props} className={`${className ?? ""} cursor-pointer appearance-none pr-10`} />
      <Icon name="chevron-down" className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2" />
    </div>
  );
}
