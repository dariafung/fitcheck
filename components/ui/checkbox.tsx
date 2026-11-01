import type { InputHTMLAttributes } from "react";
import { Icon } from "./icon";

// The one on / off control: a square ink-edged box that fills with ink and
// shows a white check when on. A real checkbox underneath, so labels,
// keyboard and screen readers work as usual.
export function Checkbox({ className, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <span className={`relative inline-flex size-5 shrink-0 ${className ?? ""}`}>
      <input type="checkbox" {...props} className="checkbox peer" />
      <Icon
        name="check"
        className="pointer-events-none absolute inset-0.5 hidden text-paper peer-checked:block"
      />
    </span>
  );
}
