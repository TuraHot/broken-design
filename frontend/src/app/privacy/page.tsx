// /privacy — Privacy Policy (draft, needs legal review)
import type { Metadata } from 'next';
import Link from 'next/link';
import LegalPage from '@/components/content/LegalPage';
import { getT } from '@/lib/i18n/server';
import PrivacyTh from './th';
import { C, DataTable, P, UL } from '@/components/content/prose';

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getT();
  return { title: locale === 'th' ? 'นโยบายความเป็นส่วนตัว · Lixyte' : 'Privacy Policy · Lixyte' };
}

const link = 'text-white underline underline-offset-4';

export default async function PrivacyPage() {
  const { locale } = await getT();
  return locale === 'th' ? <PrivacyTh /> : <PrivacyPageEn />;
}

function PrivacyPageEn() {
  return (
    <LegalPage
      current="/privacy"
      title="Privacy Policy"
      intro="What information Lixyte keeps about you, why, and who can see it."
      sections={[
        {
          id: 'collect',
          title: '1. What we keep',
          body: (
            <DataTable
              caption="Information Lixyte keeps"
              head={['Information', 'Why we keep it']}
              rows={[
                ['Email address and display name', 'To identify your account and let you log in.'],
                ['Password', 'Stored only as a one-way hash, never as readable text.'],
                ['Account status', 'Whether you are a seller, an administrator, or suspended.'],
                ['Purchases', 'Which model you bought, the price, currency, license, the time, your embed key and the mark added to your download.'],
                ['Models you publish', 'The file, preview, cover image, title, description, tags, license and price.'],
                ['Reports you send', 'What you wrote, the model it is about, and how an administrator handled it.'],
                ['Technical data', 'Your network address, to limit abuse (for example repeated wrong embed keys), and routine server logs.'],
              ]}
            />
          ),
        },
        {
          id: 'browser',
          title: '2. What stays in your browser',
          body: (
            <UL>
              <li>When you log in, a sign-in token is saved in your browser&apos;s local storage so that you stay logged in. Logging out removes it.</li>
              <li>We save the language you choose in a cookie named <C>lang</C>, only to remember that setting.</li>
              <li>We do not use advertising or tracking cookies, and we do not run analytics at the moment. <C>[TO DECIDE: confirm before launch, and add a cookie banner if this changes]</C></li>
              <li>Pages that embed a model with <C>embed.js</C> load the 3D viewer from Google&apos;s servers, so Google may receive the visitor&apos;s network address.</li>
            </UL>
          ),
        },
        {
          id: 'use',
          title: '3. How we use it',
          body: (
            <UL>
              <li>To run the service: log you in, show models, process purchases and stream files.</li>
              <li>To keep it safe: limit abuse, trace a leaked file to its purchase, and handle reports.</li>
              <li>To contact you about your account when we have to.</li>
            </UL>
          ),
        },
        {
          id: 'sharing',
          title: '4. Who can see it',
          body: (
            <>
              <UL>
                <li><strong className="font-medium text-white/80">Sellers</strong> see the display name of the people who bought their models, the price and the date.</li>
                <li><strong className="font-medium text-white/80">Administrators</strong> can see accounts, models, purchases (including the buyer&apos;s email) and reports. The admin pages do not show passwords or embed keys.</li>
                <li><strong className="font-medium text-white/80">The public</strong> sees your display name on models you publish, and your published models.</li>
                <li><strong className="font-medium text-white/80">Service providers</strong> that run Lixyte for us see the data they host: the database and file storage provider, and the payment provider once real payments start. <C>[TO DECIDE: list the providers and their countries]</C></li>
              </UL>
              <P>We do not sell your information. We may share it when the law requires it.</P>
            </>
          ),
        },
        {
          id: 'keep',
          title: '5. How long we keep it',
          body: (
            <>
              <P>Purchase records are kept for as long as the model and the license exist, so that buyers keep their access and files can be traced. Removing a model hides it; it does not erase the purchases made before.</P>
              <P><C>[TO DECIDE: retention periods for accounts, purchases, reports and logs, and what happens when an account is deleted]</C></P>
            </>
          ),
        },
        {
          id: 'rights',
          title: '6. Your choices',
          body: (
            <>
              <P>You can ask to see, correct or delete the information we hold about you. Account deletion and a settings page are not built yet, so for now make the request by contacting us. <C>[TO DECIDE: contact email address and the law that applies, for example Thailand&apos;s PDPA]</C></P>
              <P>To report something about your data or an account, use <strong className="font-medium text-white/80">Report a problem</strong> in the account menu or the footer.</P>
            </>
          ),
        },
        {
          id: 'security',
          title: '7. Security',
          body: (
            <>
              <P>Passwords are hashed. Full files of paid models are sent only with a valid embed key or to the buyer. Access rights are checked on the server, not only in the page. No system is perfectly safe, so keep your password and embed keys private.</P>
              <P>More: <Link href="/terms" className={link}>Terms of Service</Link>.</P>
            </>
          ),
        },
      ]}
    />
  );
}
