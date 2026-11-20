'use client';

// The written reason an admin gives when a change is sent to a person as a notice (license change, hide, suspend).
// One field for every dialog, so the limits, the counter and the hints cannot drift apart.
import { REASON_MAX, REASON_MIN } from '@/lib/admin-api';
import { useT } from '@/lib/i18n/client';

/** A reason is valid when it is at most REASON_MAX long and, if `required`, at least REASON_MIN (after trimming). */
export function isReasonValid(value: string, required: boolean) {
  const length = value.trim().length;
  return length <= REASON_MAX && (!required || length >= REASON_MIN);
}

export default function ReasonField({
  id,
  label,
  value,
  onChange,
  required,
  rows = 4,
  hint,
}: {
  /** Unique on the page: the hint and the counter are linked to the field through it. */
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** True when the action cannot go ahead without a reason (the "too short" warning only appears then). */
  required: boolean;
  rows?: number;
  /** Replaces the default hint, which says the owner reads the reason (not true when only admins see it). */
  hint?: string;
}) {
  const t = useT();
  const length = value.trim().length;
  return (
    <div>
      <label htmlFor={id} className="text-sm text-ink-soft">{label}</label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={REASON_MAX}
        rows={rows}
        aria-describedby={`${id}-hint ${id}-count`}
        className="mt-1.5 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink placeholder:text-ink/40 focus:border-ink/50 focus:outline-none"
      />
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-ink/50">
        <span id={`${id}-hint`}>{hint ?? t('admin.license.reasonHint')}</span>
        <span id={`${id}-count`} className="font-mono">{t('admin.license.count', { n: length, max: REASON_MAX })}</span>
      </div>
      {required && length > 0 && length < REASON_MIN && (
        <p className="mt-1.5 text-xs text-warn">{t('admin.license.errShort', { min: REASON_MIN })}</p>
      )}
    </div>
  );
}
