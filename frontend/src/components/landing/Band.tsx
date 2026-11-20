// One full-width "page" of the landing page below the hero. Pages are stacked with no gaps, split by a hairline, and
// can be tinted, so the page reads as one continuous sheet (like the reference). With `page`, from `md` the band is at
// least one screen tall (minus the navbar) and its content is centred, so one scroll gesture = one page.
// `full` drops the width limit and side padding: the content then spans the whole screen and is responsible for its
// own gutters (the popular row uses it).
export default function Band({
  children,
  id,
  tint = false,
  full = false,
  page = false,
}: {
  children: React.ReactNode;
  id?: string;
  tint?: boolean;
  full?: boolean;
  page?: boolean;
}) {
  const width = full ? '' : 'mx-auto max-w-[1400px] px-4 md:px-6';
  const height = page ? 'md:flex md:min-h-[calc(100dvh-4rem)] md:flex-col md:justify-center' : '';
  return (
    <div id={id} className={`relative z-10 scroll-mt-16 border-t border-line ${tint ? 'bg-card/40' : ''}`}>
      <div className={`${width} py-10 md:py-8 ${height}`}>{children}</div>
    </div>
  );
}
