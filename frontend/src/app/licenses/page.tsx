// /licenses — what each model license lets you do
import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, X } from 'lucide-react';
import DocLayout from '@/components/content/DocLayout';
import { C, Callout, DataTable, OL, P, PageHeader, Section, UL } from '@/components/content/prose';
import { getT } from '@/lib/i18n/server';
import { LICENSE_INFO } from '@/lib/licenses';
import { LICENSES } from '@/lib/types';
import { MATRIX, type Cell } from './matrix';
import LicensesTh from './th';

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getT();
  return locale === 'th'
    ? { title: 'สัญญาอนุญาตของโมเดล · Lixyte', description: 'สิ่งที่ทำได้และทำไม่ได้กับโมเดลภายใต้ CC0, CC BY, CC BY-NC และสัญญาอนุญาตเชิงพาณิชย์' }
    : { title: 'Model licenses · Lixyte', description: 'What you can and cannot do with a model under CC0, CC BY, CC BY-NC and the commercial license.' };
}

const TOC = [
  { id: 'overview', title: 'The four licenses' },
  { id: 'compare', title: 'Compare at a glance' },
  { id: 'credit', title: 'How to credit a creator' },
  { id: 'buying', title: 'When you buy a model' },
  { id: 'choosing', title: 'Choosing one as a creator' },
];

function Mark({ value }: { value: Cell }) {
  if (value === 'yes') {
    return (
      <span className="inline-flex items-center gap-1.5 text-ink/80">
        <Check aria-hidden className="h-4 w-4 text-emerald-400" />
        Yes
      </span>
    );
  }
  if (value === 'credit') {
    return (
      <span className="inline-flex items-center gap-1.5 text-ink/80">
        <Check aria-hidden className="h-4 w-4 text-emerald-400" />
        Yes, with credit
      </span>
    );
  }
  if (value === 'no') {
    return (
      <span className="inline-flex items-center gap-1.5 text-ink/80">
        <X aria-hidden className="h-4 w-4 text-danger" />
        No
      </span>
    );
  }
  return <span className="text-ink-soft">Not defined yet*</span>;
}

export default async function LicensesPage() {
  const { locale } = await getT();
  return locale === 'th' ? <LicensesTh /> : <LicensesEn />;
}

function LicensesEn() {
  return (
    <main className="mx-auto max-w-[1400px] px-4 pb-16 pt-24 md:px-6">
      <PageHeader
        label="Licenses"
        title="Model licenses"
        intro={
          <>
            Every model on Lixyte has one license. It is shown as a badge on the model card and explained on the model page. This page says the same thing
            in plain words, in one place. These are summaries, not legal text: the{' '}
            <Link href="/terms" className="text-ink underline underline-offset-4">terms of service</Link> and the license of each model are what count.
          </>
        }
      />

      <DocLayout toc={TOC}>
        <Section id="overview" title="The four licenses">
          <div className="grid gap-4 sm:grid-cols-2">
            {LICENSES.map((lic) => {
              const info = LICENSE_INFO[lic];
              return (
                <article key={lic} className="rounded-lg border border-line bg-ink/5 p-5">
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-accent">{lic}</p>
                  <h3 className="mt-2 text-[15px] font-medium text-ink">{info.name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">{info.summary}</p>
                  <ul className="mt-4 grid gap-2 text-sm">
                    {info.rules.map((r) => (
                      <li key={r.text} className="flex items-start gap-2 text-ink/80">
                        {r.ok ? (
                          <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                        ) : (
                          <X aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                        )}
                        <span>
                          <span className="sr-only">{r.ok ? 'Allowed: ' : 'Not allowed: '}</span>
                          {r.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </Section>

        <Section id="compare" title="Compare at a glance">
          <DataTable
            caption="What each license allows"
            head={['License', 'Commercial use', 'Modify', 'Credit the creator', 'Share the file']}
            rows={LICENSES.map((lic) => [
              LICENSE_INFO[lic].name,
              <Mark key="c" value={MATRIX[lic].commercial} />,
              <Mark key="m" value={MATRIX[lic].modify} />,
              MATRIX[lic].credit === 'credit' ? <span key="cr" className="text-ink/80">Required</span> : <span key="cr">Not needed</span>,
              <Mark key="s" value={MATRIX[lic].resell} />,
            ])}
          />
          <UL>
            <li>With CC BY-NC you may share the file only for non-commercial purposes, and always with credit.</li>
            <li>* The platform does not yet say whether you may change a model you bought under the commercial license. Ask the creator before you do. Selling or passing on the file is not allowed under the commercial license.</li>
          </UL>
          <Callout title="Free to use is not the same as free to upload">
            You can use a CC0 model in your own work, but you cannot upload it to Lixyte as if it were yours. Uploading a model you did not make or
            have no right to share breaks the <Link href="/seller-terms" className="text-ink underline underline-offset-4">seller terms</Link>.
          </Callout>
        </Section>

        <Section id="credit" title="How to credit a creator">
          <P>For CC BY and CC BY-NC models, put a credit where people can see it, for example in the footer of your page or in your credits screen. A good credit has four parts:</P>
          <UL>
            <li>The title of the model.</li>
            <li>The name of the creator, linked to their profile on Lixyte.</li>
            <li>The license (for example <C>CC BY</C>).</li>
            <li>A link to the model page on Lixyte.</li>
          </UL>
          <P>
            Example: <C>&quot;Spectral Lily&quot; by Mira Okafor, CC BY, from Lixyte</C>
          </P>
        </Section>

        <Section id="buying" title="When you buy a model">
          <UL>
            <li>The price, the currency and the license are fixed at the moment you buy. If the creator changes them later, your purchase stays as it was.</li>
            <li>You get an embed key to show the model on your own website, and you can download the file. See the <Link href="/docs" className="text-ink underline underline-offset-4">docs</Link>.</li>
            <li>The file you download carries a hidden mark with your purchase and license. It lets us trace a leaked copy back to its purchase. Removing the mark, or sharing the file, breaks the license.</li>
            <li>If an admin hides a model or suspends its owner, the model stops working for everyone, including people who bought it. See the <Link href="/refunds" className="text-ink underline underline-offset-4">refund policy</Link> for what you can do then.</li>
          </UL>
        </Section>

        <Section id="choosing" title="Choosing one as a creator">
          <OL>
            <li>Do you want money for the model? Choose <C>COMMERCIAL</C> and set a price. Buyers get the full file and your embed key system protects it.</li>
            <li>Do you want it used widely with no strings? Choose <C>CC0</C>.</li>
            <li>Do you want credit for your work? Choose <C>CC BY</C>.</li>
            <li>Do you want it free for hobby and school projects but paid for business? Choose <C>CC BY-NC</C>.</li>
          </OL>
          <P>Only upload models you made or have the right to share. See the <Link href="/seller-terms" className="text-ink underline underline-offset-4">seller terms</Link> and the <Link href="/dmca" className="text-ink underline underline-offset-4">copyright policy</Link>.</P>
        </Section>
      </DocLayout>
    </main>
  );
}
