// /dmca — copyright complaints and takedown (draft, needs legal review)
import type { Metadata } from 'next';
import Link from 'next/link';
import LegalPage from '@/components/content/LegalPage';
import { getT } from '@/lib/i18n/server';
import DmcaTh from './th';
import { C, OL, P, UL } from '@/components/content/prose';

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getT();
  return { title: locale === 'th' ? 'ลิขสิทธิ์และ DMCA · Lixyte' : 'Copyright & DMCA · Lixyte' };
}

const link = 'text-ink underline underline-offset-4';

export default async function DmcaPage() {
  const { locale } = await getT();
  return locale === 'th' ? <DmcaTh /> : <DmcaPageEn />;
}

function DmcaPageEn() {
  return (
    <LegalPage
      current="/dmca"
      title="Copyright & DMCA"
      intro="Lixyte respects the rights of creators. This page explains how to tell us that a model on Lixyte copies your work, and what happens next."
      sections={[
        {
          id: 'report',
          title: '1. How to report a copied model',
          body: (
            <>
              <OL>
                <li>Log in, then open <strong className="font-medium text-ink">Report a problem</strong> in the account menu or the footer.</li>
                <li>Choose <strong className="font-medium text-ink">A model</strong> and paste the address of the model page.</li>
                <li>Explain what was copied, where the original is, and why you own it.</li>
              </OL>
              <P>If you cannot log in, write to <C>[TO DECIDE: copyright contact email address]</C>.</P>
            </>
          ),
        },
        {
          id: 'include',
          title: '2. What to include',
          body: (
            <UL>
              <li>The address of the model on Lixyte.</li>
              <li>A link to, or proof of, your original work.</li>
              <li>Your name and a way to reach you.</li>
              <li>A statement that you are the owner or act for the owner, and that your report is true.</li>
            </UL>
          ),
        },
        {
          id: 'happens',
          title: '3. What happens next',
          body: (
            <>
              <UL>
                <li>An administrator reads the report. Reports are shown in the admin area and are handled in order, newest problems first.</li>
                <li>If the claim looks valid the administrator hides the model. A hidden model disappears from the gallery and stops working everywhere, including for people who bought it.</li>
                <li>The report is marked resolved or dismissed with a note that records the decision.</li>
              </UL>
              <P>Telling the seller about the report: <C>[TO DECIDE: how and when the seller is told]</C>.</P>
            </>
          ),
        },
        {
          id: 'counter',
          title: '4. If your model was hidden by mistake',
          body: (
            <>
              <P>If you are the seller and you believe your model was hidden by mistake, send a report that explains why the model is yours, with proof, for example your project files. An administrator can restore the model if the claim is withdrawn or turns out to be wrong.</P>
              <P><C>[TO DECIDE, with a lawyer: the formal counter-notice steps and waiting time that apply to the country where Lixyte operates]</C></P>
            </>
          ),
        },
        {
          id: 'repeat',
          title: '5. Repeat infringers and false claims',
          body: (
            <UL>
              <li>An account that keeps publishing copied models can be suspended. Its models then stop working.</li>
              <li>Sending a report you know is false can lead to your account being suspended.</li>
            </UL>
          ),
        },
        {
          id: 'law',
          title: '6. Applicable law',
          body: (
            <P>
              <C>[TO DECIDE: the law and procedure this policy follows. The name &quot;DMCA&quot; refers to United States law; replace or add the rules of the country where Lixyte is run.]</C>{' '}
              See also the <Link href="/seller-terms" className={link}>Seller Terms</Link>.
            </P>
          ),
        },
      ]}
    />
  );
}
