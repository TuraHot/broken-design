// One full-width band of the landing page below the hero. Bands are stacked with no gaps, split by a hairline, and can
// be tinted, so the page reads as one continuous sheet (like the reference) and each band is as tall as its content.
// `full` drops the width limit and side padding: the content then spans the whole screen and is responsible for its
// own gutters (the popular row uses it). The right padding keeps content clear of the side rail on mid-width screens.
export default function Band({
  children,
  id,
  tint = false,
  full = false,
}: {
  children: React.ReactNode;
  id?: string;
  tint?: boolean;
  full?: boolean;
}) {
  const width = full ? '' : 'mx-auto max-w-[1400px] px-4 md:pl-6 md:pr-[76px] min-[1550px]:pr-6';
  return (
    <div id={id} className={`relative z-10 scroll-mt-16 border-t border-line ${tint ? 'bg-card/40' : ''}`}>
      <div className={`${width} py-12 md:py-14`}>{children}</div>
    </div>
  );
}
