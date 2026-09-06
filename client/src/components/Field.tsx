import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

interface FieldState {
  readOnly?: boolean;
  invalid?: boolean;
  multiline?: boolean;
}

/** Editable, read-only, and invalid must be distinguishable (ui-spec section 2). */
export function fieldClass({ readOnly, invalid, multiline }: FieldState = {}): string {
  return [
    "zg-field",
    multiline && "zg-field--multiline",
    readOnly && "zg-field--readonly",
    invalid && "zg-field--invalid",
  ]
    .filter(Boolean)
    .join(" ");
}

interface FieldProps {
  id: string;
  label: string;
  required?: boolean;
  invalid?: boolean;
  /** Validation message. Renders beneath the control, never as a top banner (BR-44). */
  message?: string;
  /** Helper text shown when there is no message. */
  hint?: string;
  children: ReactNode;
}

// Label above control, message below — one layout everywhere (ui-spec section 3.1).
export function Field({ id, label, required, invalid, message, hint, children }: FieldProps) {
  const text = message ?? hint ?? "";

  return (
    <div className="zg-field-group">
      <label className="zg-label" htmlFor={id}>
        {label}
        {/* The asterisk marks the field; it never replaces the message (AC-37). */}
        {required && (
          <span className="zg-required" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {children}

      <p
        id={`${id}-message`}
        className={`zg-field-message${invalid && message ? " zg-field-message--error" : ""}`}
      >
        {text}
      </p>
    </div>
  );
}

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "className"> &
  Omit<FieldProps, "children">;

export function TextField({
  id,
  label,
  required,
  invalid,
  message,
  hint,
  readOnly,
  ...input
}: TextFieldProps) {
  return (
    <Field id={id} label={label} required={required} invalid={invalid} message={message} hint={hint}>
      <input
        {...input}
        id={id}
        readOnly={readOnly}
        className={fieldClass({ readOnly, invalid })}
        aria-required={required || undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={`${id}-message`}
      />
    </Field>
  );
}

type TextAreaFieldProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id" | "className"> &
  Omit<FieldProps, "children">;

export function TextAreaField({
  id,
  label,
  required,
  invalid,
  message,
  hint,
  readOnly,
  rows = 6,
  ...textarea
}: TextAreaFieldProps) {
  return (
    <Field id={id} label={label} required={required} invalid={invalid} message={message} hint={hint}>
      <textarea
        {...textarea}
        id={id}
        rows={rows}
        readOnly={readOnly}
        className={fieldClass({ readOnly, invalid, multiline: true })}
        aria-required={required || undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={`${id}-message`}
      />
    </Field>
  );
}
