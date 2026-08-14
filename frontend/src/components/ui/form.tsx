"use client";

import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

/**
 * Shared form controls. Every control renders its own label, inline validation
 * message and the `aria-invalid` / `aria-describedby` wiring, so a page never has
 * to repeat that markup — and a failed validation is always announced, not just
 * coloured red.
 */

interface FieldProps {
  label?: string;
  error?: string;
  hint?: string;
  wrapperClassName?: string;
}

function controlClasses(hasError: boolean, extra = ""): string {
  const base =
    "w-full rounded-md border px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500";
  const tone = hasError
    ? "border-red-400 focus:border-red-500 focus:ring-red-500"
    : "border-zinc-300 focus:border-zinc-500 focus:ring-zinc-500";
  return `${base} ${tone} ${extra}`;
}

function FieldShell({
  id,
  label,
  error,
  hint,
  className = "",
  children,
}: {
  id: string;
  label?: string;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-zinc-700">
          {label}
        </label>
      )}
      <div className={label ? "mt-1" : undefined}>{children}</div>
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-zinc-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

function describedBy(id: string, error?: string, hint?: string): string | undefined {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

export type InputProps = FieldProps & InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, wrapperClassName, className = "", id, ...rest },
  ref
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <FieldShell
      id={inputId}
      label={label}
      error={error}
      hint={hint}
      className={wrapperClassName}
    >
      <input
        id={inputId}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(inputId, error, hint)}
        className={controlClasses(!!error, className)}
        {...rest}
      />
    </FieldShell>
  );
});

export type TextareaProps = FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, hint, wrapperClassName, className = "", id, ...rest },
  ref
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <FieldShell
      id={inputId}
      label={label}
      error={error}
      hint={hint}
      className={wrapperClassName}
    >
      <textarea
        id={inputId}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(inputId, error, hint)}
        className={controlClasses(!!error, className)}
        {...rest}
      />
    </FieldShell>
  );
});

export type SelectProps = FieldProps & SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, hint, wrapperClassName, className = "", id, children, ...rest },
  ref
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <FieldShell
      id={inputId}
      label={label}
      error={error}
      hint={hint}
      className={wrapperClassName}
    >
      <select
        id={inputId}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(inputId, error, hint)}
        className={controlClasses(!!error, `bg-white ${className}`)}
        {...rest}
      >
        {children}
      </select>
    </FieldShell>
  );
});

export type CheckboxProps = Omit<FieldProps, "label"> &
  InputHTMLAttributes<HTMLInputElement> & { label: string };

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, error, hint, wrapperClassName = "", className = "", id, ...rest },
  ref
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <div className={wrapperClassName}>
      <div className="flex items-center gap-2">
        <input
          id={inputId}
          ref={ref}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(inputId, error, hint)}
          className={`h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500 ${className}`}
          {...rest}
        />
        <label htmlFor={inputId} className="text-sm text-zinc-700">
          {label}
        </label>
      </div>
      {hint && !error && (
        <p id={`${inputId}-hint`} className="mt-1 text-xs text-zinc-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${inputId}-error`} role="alert" className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
});
