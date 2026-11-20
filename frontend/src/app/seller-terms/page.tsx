// /seller-terms — extra rules for people who publish models (draft, needs legal review)
import type { Metadata } from 'next';
import Link from 'next/link';
import LegalPage from '@/components/content/LegalPage';
import { getT } from '@/lib/i18n/server';
import SellerTermsTh from './th';
import { C, DataTable, P, UL } from '@/components/content/prose';

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getT();
  return { title: locale === 'th' ? 'ข้อกำหนดสำหรับผู้ขาย · Lixyte' : 'Seller Terms · Lixyte' };
}

const link = 'text-ink underline underline-offset-4';

export default async function SellerTermsPage() {
  const { locale } = await getT();
  return locale === 'th' ? <SellerTermsTh /> : <SellerTermsPageEn />;
}

function SellerTermsPageEn() {
  return (
    <LegalPage
      current="/seller-terms"
      title="Seller Terms"
      intro={
        <>
          Extra rules for people who publish models, free or paid. They apply together with the{' '}
          <Link href="/terms" className={link}>Terms of Service</Link>.
        </>
      }
      sections={[
        {
          id: 'start',
          title: '1. Becoming a seller',
          body: (
            <P>Any account can turn on seller mode in the Library. By doing so you agree to these terms. You can publish free models without setting up payment. <C>[TO DECIDE: any identity or payout details required before a paid model can be sold]</C></P>
          ),
        },
        {
          id: 'rights',
          title: '2. Only publish what is yours',
          body: (
            <UL>
              <li>You must have made the model, or have the right to publish it under the license you choose.</li>
              <li>Do not upload models copied from other creators, from games or films, or from other marketplaces without permission.</li>
              <li>Do not publish models that contain other people&apos;s trademarks or likeness in a way you have no right to.</li>
              <li>You are responsible for your models. If someone claims one is theirs, see the <Link href="/dmca" className={link}>copyright policy</Link>.</li>
            </UL>
          ),
        },
        {
          id: 'files',
          title: '3. Files',
          body: (
            <DataTable
              caption="File rules for uploads"
              head={['File', 'Rule']}
              rows={[
                ['Main file', <span key="a"><C>.glb</C> (binary glTF 2.0), up to 50 MB.</span>],
                ['Preview file', 'Up to 5 MB. Required for every paid model. It is the only file people can see before they buy.'],
                ['Cover image', 'Up to 1 MB.'],
              ]}
            />
          ),
        },
        {
          id: 'license-price',
          title: '4. License and price',
          body: (
            <UL>
              <li>Choose one license per model: CC0, CC BY, CC BY-NC or commercial (see <Link href="/licenses" className={link}>licenses</Link>). A price of 0 makes the model free.</li>
              <li>The price, currency and license are locked for each purchase. A buyer keeps what they bought even if you change the model later.</li>
              <li>You cannot take back a CC license once people have used the model under it.</li>
            </UL>
          ),
        },
        {
          id: 'marks',
          title: '5. Hidden marks',
          body: (
            <P>Lixyte adds a hidden signature to every file you upload, and adds the buyer&apos;s purchase to each paid download. You allow this. It protects you and your buyers, and you must not try to remove it from files you upload.</P>
          ),
        },
        {
          id: 'removal',
          title: '6. Removing a model and moderation',
          body: (
            <UL>
              <li>If you remove a model it leaves the gallery. People who already bought it keep their access.</li>
              <li>Administrators can hide a model, or suspend your account, if you break the rules or while they look into a report. A hidden model stops working for everyone, including buyers, until it is restored.</li>
              <li>You can see what happened to your models in your Seller dashboard.</li>
            </UL>
          ),
        },
        {
          id: 'money',
          title: '7. Payouts, fees and tax',
          body: (
            <>
              <P>Platform fee: <C>[TO DECIDE: percentage taken from each sale]</C>.</P>
              <P>Payouts: <C>[TO DECIDE: how and when sellers are paid, the minimum amount, the currency]</C>. At the moment payments are simulated and no money moves.</P>
              <P>Taxes on what you earn are your responsibility. <C>[TO DECIDE: whether Lixyte collects or reports any tax]</C></P>
            </>
          ),
        },
        {
          id: 'end',
          title: '8. Ending seller mode',
          body: (
            <P>You can stop publishing at any time by removing your models. We can end your seller mode for serious or repeated breaches of these terms. <C>[TO DECIDE: what happens to money owed and to buyers&apos; access when a seller account is closed]</C></P>
          ),
        },
      ]}
    />
  );
}
