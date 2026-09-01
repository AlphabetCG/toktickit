import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "destructive";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** In-flight state: disables the control and announces it (BR-43). */
  busy?: boolean;
  /** Label shown while busy. Falls back to the idle label. */
  busyLabel?: string;
  children: ReactNode;
}

// Every button carries visible text — icons support text, never replace it
// (ui-spec section 4).
export function Button({
  variant = "secondary",
  busy = false,
  busyLabel,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  const classes = ["zg-btn", `zg-btn--${variant}`, busy && "zg-btn--busy", className]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      {...rest}
      className={classes}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
    >
      {busy && <span className="zg-btn__spinner" aria-hidden="true" />}
      {busy ? busyLabel ?? children : children}
    </button>
  );
}
