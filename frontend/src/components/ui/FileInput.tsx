"use client";

import { forwardRef, useId, useRef } from "react";
import { describedBy, FieldShell, type FieldProps } from "./form";

export type FileInputProps = FieldProps & {
  id?: string;
  accept?: string;
  disabled?: boolean;
  selectedFileName?: string | null;
  onFileChange: (file: File | null) => void;
};

/**
 * A native file input styled to match the rest of the form kit. Doesn't reuse
 * `controlClasses` (a native file input renders its own button chrome that ignores
 * text-input styling) — same "opts out, manages its own layout" precedent `Checkbox`
 * already sets in form.tsx.
 */
export const FileInput = forwardRef<HTMLInputElement, FileInputProps>(function FileInput(
  { label, error, hint, wrapperClassName, id, accept, disabled, selectedFileName, onFileChange },
  ref
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const internalRef = useRef<HTMLInputElement>(null);

  const setRefs = (element: HTMLInputElement | null) => {
    internalRef.current = element;
    if (typeof ref === "function") {
      ref(element);
    } else if (ref) {
      ref.current = element;
    }
  };

  const handleClear = () => {
    if (internalRef.current) {
      internalRef.current.value = "";
    }
    onFileChange(null);
  };

  return (
    <FieldShell id={inputId} label={label} error={error} hint={hint} className={wrapperClassName}>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={inputId}
          ref={setRefs}
          type="file"
          accept={accept}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(inputId, error, hint)}
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-zinc-700 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
        />
        {selectedFileName && (
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            className="text-xs font-medium text-zinc-500 hover:text-zinc-800 disabled:cursor-not-allowed"
          >
            Remove
          </button>
        )}
      </div>
    </FieldShell>
  );
});
