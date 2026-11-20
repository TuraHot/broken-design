// One full-width band of the landing page. Bands are stacked with no gaps, split by a hairline, and every other one is
// tinted, so the page reads as one continuous sheet (like the reference) instead of separate floating blocks.
// `full` drops the width limit and side padding: the band's content then spans the whole screen and is responsible
// for its own gutters (the popular row uses it).
export default function Band({
  children,
  tint = false,
  full = false,
}: {
  children: React.ReactNode;
  tint?: boolean;
  full?: boolean;
}) {
  return (
    <div className={`relative z-10 border-t border-line ${tint ? 'bg-card/40' : ''}`}>
      <div className={full ? 'py-10 md:py-12' : 'mx-auto max-w-[1400px] px-4 py-10 md:px-6 md:py-12'}>{children}</div>
    </div>
  );
}
