// /refunds — Refund Policy (draft, needs a decision from the team and legal review)
import type { Metadata } from 'next';
import Link from 'next/link';
import LegalPage from '@/components/content/LegalPage';
import { getT } from '@/lib/i18n/server';
import RefundsTh from './th';
import { C, OL, P, UL } from '@/components/content/prose';

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getT();
  return { title: locale === 'th' ? 'นโยบายการคืนเงิน · Lixyte' : 'Refund Policy · Lixyte' };
}

const link = 'text-ink underline underline-offset-4';

export default async function RefundsPage() {
  const { locale } = await getT();
  return locale === 'th' ? <RefundsTh /> : <RefundsPageEn />;
}

function RefundsPageEn() {
  return (
    <LegalPage
      current="/refunds"
      title="Refund Policy"
      intro="What happens if you paid for a model and something went wrong."
      sections={[
        {
          id: 'basics',
          title: '1. The basics',
          body: (
            <>
              <P>Models are digital files. When you buy one you get an embed key and the right to download the file straight away, so a purchase is generally final.</P>
              <P>We make an exception when something is wrong that is not your fault, as described below.</P>
            </>
          ),
        },
        {
          id: 'when',
          title: '2. When you can ask for a refund',
          body: (
            <>
              <UL>
                <li>The file is broken, empty or cannot be opened, and the seller cannot fix it.</li>
                <li>The model is clearly not what the page described.</li>
                <li>You were charged twice for the same model, or charged and received nothing.</li>
                <li>The model was hidden for breaking the rules (for example, it was copied) soon after you bought it.</li>
              </UL>
              <P>Time limit to ask: <C>[TO DECIDE: number of days after the purchase]</C>.</P>
            </>
          ),
        },
        {
          id: 'not',
          title: '3. When we will not refund',
          body: (
            <UL>
              <li>You changed your mind, or no longer need the model, after you downloaded it or used the embed key.</li>
              <li>The model works as described but is not to your taste.</li>
              <li>You shared the file or removed its hidden mark.</li>
            </UL>
          ),
        },
        {
          id: 'how',
          title: '4. How to ask',
          body: (
            <>
              <OL>
                <li>Log in and open <strong className="font-medium text-ink">Report a problem</strong> in the account menu or the footer.</li>
                <li>Choose <strong className="font-medium text-ink">A purchase or payment</strong>. Paste the model address if you have it.</li>
                <li>Tell us what went wrong, the date, and the amount. An administrator reads your report and answers.</li>
              </OL>
              <P>You can follow the statement of the purchase in your <Link href="/me" className={link}>Library</Link>.</P>
            </>
          ),
        },
        {
          id: 'process',
          title: '5. How a refund is paid',
          body: (
            <>
              <P>Refunds are decided by an administrator and are paid back to the way you paid. The platform has no refund button yet, so for now an administrator does it by hand with the payment provider. When a refund is given, your embed key for that model is turned off.</P>
              <P><C>[TO DECIDE: payment provider, how long a refund takes, and whether the seller&apos;s earnings are reduced]</C> At the moment payments are simulated, so no real money is involved.</P>
            </>
          ),
        },
        {
          id: 'hidden',
          title: '6. If a model you bought is hidden',
          body: (
            <P>An administrator can hide a model that breaks the rules, and it then stops working for everyone, including buyers. If that happens to a model you paid for, ask for a refund as in section 4. <C>[TO DECIDE: refund automatically, or only on request]</C> See also the <Link href="/terms" className={link}>Terms of Service</Link>.</P>
          ),
        },
      ]}
    />
  );
}
