'use client';

// Lets any component open the "Report a problem" popup (account menu, footer).
// On a model page the model link is filled in for you.
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { extractModelId } from '@/lib/complaints';
import { useT } from '@/lib/i18n/client';
import ReportForm from './ReportForm';

const ReportContext = createContext<{ openReport: () => void }>({ openReport: () => {} });

export const useReport = () => useContext(ReportContext);

export default function ReportProvider({ children }: { children: React.ReactNode }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [prefill, setPrefill] = useState('');

  const openReport = useCallback(() => {
    const here = window.location.href;
    // Only real models (their id is a UUID) can be reported; sample catalogue pages start empty.
    setPrefill(window.location.pathname.startsWith('/models/') && extractModelId(here) ? here : '');
    setOpen(true);
  }, []);
  const close = useCallback(() => setOpen(false), []);
  const value = useMemo(() => ({ openReport }), [openReport]);

  return (
    <ReportContext.Provider value={value}>
      {children}
      {open && (
        <Modal title={t('report.title')} onClose={close}>
          <ReportForm initialModelRef={prefill} onClose={close} />
        </Modal>
      )}
    </ReportContext.Provider>
  );
}
