'use client';

// Admin dialog: one purchase in full, read only. The embed key is never part of it (it is the buyer's secret).
import { useEffect, useState } from 'react';
import { Badge } from '@/components/admin/ui';
import Modal from '@/components/ui/Modal';
import { fetchPurchaseDetail, type AdminPurchaseDetail } from '@/lib/admin-api';
import { formatDateTime, formatMoney } from '@/lib/format';
import { adminErrorText } from '@/lib/i18n/admin-error';
import { useT } from '@/lib/i18n/client';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-2.5 sm:grid-cols-[170px_minmax(0,1fr)] sm:gap-4">
      <dt className="text-sm text-white/65">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-white">{children}</dd>
    </div>
  );
}

export default function PurchaseDialog({ purchaseId, onClose }: { purchaseId: string; onClose: () => void }) {
  const t = useT();
  const [data, setData] = useState<AdminPurchaseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPurchaseDetail(purchaseId)
      .then((d) => !cancelled && setData(d))
      .catch((err) => !cancelled && setError(adminErrorText(err, t, 'admin.purchase.errLoad')));
    return () => {
      cancelled = true;
    };
    // `t` changes only with the language; reloading on a language switch is harmless but not needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchaseId]);

  return (
    <Modal title={t('admin.purchase.title')} onClose={onClose} size="lg">
      {error ? (
        <p role="alert" className="text-sm text-red-300">{error}</p>
      ) : !data ? (
        <p role="status" className="text-sm text-white/65">{t('admin.loading')}</p>
      ) : (
        <div>
          <dl className="divide-y divide-white/10">
            <Row label={t('admin.purchase.id')}><span className="font-mono text-[13px]">{data.id}</span></Row>
            <Row label={t('admin.col.status')}>
              {data.status === 'paid' ? <Badge>{t('admin.paid')}</Badge> : <Badge tone="warn">{t('admin.pending')}</Badge>}
            </Row>
            <Row label={t('admin.col.buyer')}>
              <span className="flex flex-wrap items-center gap-2">
                <span>{data.buyer.displayName}</span>
                <span className="text-white/65">{data.buyer.email}</span>
                {data.buyer.isSuspended && <Badge tone="danger">{t('admin.suspended')}</Badge>}
              </span>
            </Row>
            <Row label={t('admin.col.model')}>
              <span className="flex flex-wrap items-center gap-2">
                <span>{data.model.title}</span>
                {data.model.isDeleted && <Badge>{t('admin.deleted')}</Badge>}
                {data.model.isHidden && <Badge tone="warn">{t('admin.hidden')}</Badge>}
              </span>
            </Row>
            <Row label={t('admin.col.owner')}>
              <span>{data.owner.displayName}</span> <span className="text-white/65">{data.owner.email}</span>
            </Row>
            <Row label={t('admin.col.amount')}>{formatMoney(data.amountCents, data.currency)}</Row>
            <Row label={t('admin.purchase.licenseLocked')}><span className="font-mono">{data.licenseType}</span></Row>
            <Row label={t('admin.purchase.licenseNow')}>
              <span className="font-mono">{data.model.currentLicense}</span>
              {data.model.currentLicense !== data.licenseType && (
                <p className="mt-1.5 rounded-lg border border-amber/40 bg-amber/10 px-3 py-2 text-xs text-amber">
                  {t('admin.purchase.licenseChanged')}
                </p>
              )}
            </Row>
            <Row label={t('admin.purchase.created')}>{formatDateTime(data.createdAt)}</Row>
            <Row label={t('admin.purchase.paidAt')}>{formatDateTime(data.paidAt)}</Row>
            <Row label={t('admin.purchase.session')}><span className="font-mono text-[13px]">{data.providerSessionId ?? '—'}</span></Row>
            <Row label={t('admin.col.watermark')}><span className="font-mono text-[13px]">{data.watermarkHash ?? '—'}</span></Row>
          </dl>
          <div className="mt-4 flex justify-end border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-lg border border-white/15 px-4 text-sm text-white/80 hover:border-white/40 hover:text-white"
            >
              {t('admin.edit.close')}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
