'use client';

// The text of one notice (what happened and the admin's reason). Used by the notices box on the dashboards
// and by the bell in the Navbar, so both show the same words in the same language.
import type { NoticeItem } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useT } from '@/lib/i18n/client';

export default function NoticeContent({ n }: { n: NoticeItem }) {
  const t = useT();

  // The reason is the admin's own text, shown as written.
  const reason = (text?: string | null) =>
    text ? (
      <>
        <p className="mt-2 text-xs text-white/50">{t('notice.reason')}</p>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-white/80">{text}</p>
      </>
    ) : null;

  if (n.kind === 'license_changed') {
    return (
      <>
        <p className="mt-2 text-sm text-white">
          {t('notice.licenseChanged', {
            model: n.data.modelTitle ?? '',
            from: n.data.oldLicense ?? '',
            to: n.data.newLicense ?? '',
          })}
        </p>
        {reason(n.data.reason ?? '')}
        <p className="mt-2 text-xs text-white/50">{t('notice.buyers')}</p>
      </>
    );
  }

  if (n.kind === 'model_hidden' || n.kind === 'model_restored') {
    return (
      <>
        <p className="mt-2 text-sm text-white">
          {t(n.kind === 'model_hidden' ? 'notice.modelHidden' : 'notice.modelRestored', { model: n.data.modelTitle ?? '' })}
        </p>
        {reason(n.data.reason)}
      </>
    );
  }

  if (n.kind === 'account_suspended' || n.kind === 'account_restored') {
    return (
      <>
        <p className="mt-2 text-sm text-white">
          {n.kind === 'account_suspended'
            ? n.data.until
              ? t('notice.suspendedUntil', { date: formatDate(n.data.until) })
              : t('notice.suspendedNoEnd')
            : n.data.auto
              ? t('notice.restoredAuto')
              : t('notice.restored')}
        </p>
        {reason(n.data.reason)}
      </>
    );
  }

  return <p className="mt-2 text-sm text-white">{t('notice.other')}</p>;
}
