'use client';

// Opens the "Report a problem" popup from a server-rendered text page.
import { useReport } from '@/components/report/ReportProvider';

export default function ReportButton({ children }: { children: React.ReactNode }) {
  const { openReport } = useReport();
  return (
    <button
      type="button"
      onClick={openReport}
      className="inline-flex h-10 items-center justify-center rounded-lg bg-white px-4 text-[15px] font-medium text-black transition-colors hover:bg-white/85"
    >
      {children}
    </button>
  );
}
