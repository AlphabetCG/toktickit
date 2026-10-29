import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface DialogProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Receives focus when the dialog opens; defaults to the first focusable control. */
  initialFocus?: RefObject<HTMLElement | null>;
  className?: string;
}

/**
 * Modal dialog (ui-spec §7.3, §11): labelled by its heading, traps Tab and
 * Shift+Tab inside, closes on Escape, and returns focus to whatever opened it.
 */
export function Dialog({ title, onClose, children, initialFocus, className }: DialogProps) {
  const headingId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const target = initialFocus?.current ?? panel.current?.querySelector<HTMLElement>(FOCUSABLE);
    target?.focus();
    return () => opener?.focus();
    // Runs once per opening; later prop changes must not steal focus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      close.current();
      return;
    }
    if (e.key !== "Tab" || !panel.current) return;
    const items = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="zg-dialog-backdrop" onKeyDown={onKeyDown}>
      <div
        ref={panel}
        className={["zg-dialog", className].filter(Boolean).join(" ")}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
      >
        <h3 id={headingId} className="zg-panel__heading">
          {title}
        </h3>
        {children}
      </div>
    </div>
  );
}
