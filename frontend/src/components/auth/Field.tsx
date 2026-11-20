// Shared bits of the auth forms: labelled field wrapper with an error line, input class, email check
import { AlertCircle } from 'lucide-react';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const FIELD =
  'h-10 w-full rounded-lg border bg-ink/5 px-3 text-sm text-ink placeholder:text-ink/40 focus:outline-none';

export function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm text-ink-soft">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 flex items-center gap-1.5 text-sm text-danger">
          <AlertCircle aria-hidden className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
