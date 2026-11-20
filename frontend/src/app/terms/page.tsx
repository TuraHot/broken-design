// /terms — Terms of Service (draft, needs legal review)
import type { Metadata } from 'next';
import Link from 'next/link';
import LegalPage from '@/components/content/LegalPage';
import { getT } from '@/lib/i18n/server';
import TermsTh from './th';
import { C, P, UL } from '@/components/content/prose';

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getT();
  return { title: locale === 'th' ? 'ข้อกำหนดการใช้งาน · Lixyte' : 'Terms of Service · Lixyte' };
}

const link = 'text-ink underline underline-offset-4';

export default async function TermsPage() {
  const { locale } = await getT();
  return locale === 'th' ? <TermsTh /> : <TermsPageEn />;
}

function TermsPageEn() {
  return (
    <LegalPage
      current="/terms"
      title="Terms of Service"
      intro="The rules for using Lixyte. By creating an account or using the site you agree to them."
      sections={[
        {
          id: 'about',
          title: '1. About Lixyte',
          body: (
            <>
              <P>Lixyte is a library of 3D models in the .glb format. People can find models, show them on their own websites with an embed code, download them, and publish models of their own, free or for a price. Lixyte stores the files and streams them from its CDN.</P>
              <P>Operator of the service: <C>[TO DECIDE: legal name and address of the operator]</C>.</P>
            </>
          ),
        },
        {
          id: 'accounts',
          title: '2. Your account',
          body: (
            <UL>
              <li>You need an account to buy, download paid models, publish, or send a report. You must give a real email address you can read.</li>
              <li>One account is both a buyer and a seller: you can turn on seller mode in your Library at any time.</li>
              <li>Keep your password private. You are responsible for what happens under your account.</li>
              <li>Administrator accounts are created by the operator only. They cannot buy or sell models.</li>
            </UL>
          ),
        },
        {
          id: 'content',
          title: '3. Models and licenses',
          body: (
            <>
              <P>Each model is published under one license: CC0, CC BY, CC BY-NC or a commercial license. Read what each one allows on the <Link href="/licenses" className={link}>licenses page</Link>. You must follow the license shown on the model when you use it.</P>
              <P>When you publish a model you keep ownership of it. You give Lixyte the right to store it, stream it, show its preview and cover image, add the hidden marks described below, and let people download it under the license you chose.</P>
            </>
          ),
        },
        {
          id: 'watermark',
          title: '4. Hidden marks in files',
          body: (
            <>
              <P>Every file uploaded to Lixyte is marked with a hidden signature that identifies the model and its owner. A file downloaded from a paid model is marked again with the buyer&apos;s purchase and license. This lets us trace a leaked copy to the purchase it came from.</P>
              <P>You must not remove, change or hide these marks, and you must not pass a purchased file to other people.</P>
            </>
          ),
        },
        {
          id: 'embeds',
          title: '5. Embed codes and keys',
          body: (
            <UL>
              <li>Free models can be shown on any website with the embed code.</li>
              <li>A paid model has an embed key tied to your purchase. Do not publish it on purpose, and do not share it so that others can use the model without buying it.</li>
              <li>If your key is exposed, replace it in your Library. The old key stops working at once.</li>
              <li>Do not try to guess keys or get around the limits on the CDN.</li>
            </UL>
          ),
        },
        {
          id: 'payments',
          title: '6. Prices and payments',
          body: (
            <>
              <P>The price, currency and license you see when you buy are fixed for that purchase. A later change by the seller does not affect it.</P>
              <P>Payment provider: <C>[TO DECIDE: provider, and the date real payments start]</C>. Until then, payments on the platform are simulated and no money moves.</P>
              <P>Refunds are covered in the <Link href="/refunds" className={link}>refund policy</Link>.</P>
            </>
          ),
        },
        {
          id: 'use',
          title: '7. What you must not do',
          body: (
            <UL>
              <li>Upload a model you did not make and have no right to share, or one that breaks someone&apos;s copyright or other rights.</li>
              <li>Upload files that contain malware, or content that is illegal, abusive or hateful.</li>
              <li>Copy the catalogue in bulk, overload the service, or look for ways around access checks, rate limits, hidden marks or embed keys.</li>
              <li>Use someone else&apos;s account, or pretend to be another person.</li>
              <li>Send reports you know are false.</li>
            </UL>
          ),
        },
        {
          id: 'moderation',
          title: '8. Moderation',
          body: (
            <>
              <P>Administrators can hide a model and suspend an account when these terms or the law are broken. They can also hide or suspend while they look into a report.</P>
              <UL>
                <li>A hidden model stops working for everyone at once, including people who already bought it. It disappears from the gallery and the CDN stops sending it.</li>
                <li>A suspended account cannot log in. Its models stop working in the same way.</li>
                <li>Both can be undone if the problem is solved.</li>
              </UL>
              <P>To report a problem, use <strong className="font-medium text-ink">Report a problem</strong> in the account menu or the footer. For copyright, see the <Link href="/dmca" className={link}>copyright policy</Link>.</P>
            </>
          ),
        },
        {
          id: 'liability',
          title: '9. Availability and liability',
          body: (
            <>
              <P>We try to keep Lixyte running, but we do not promise it will always be available or free of errors. Models are provided by their creators.</P>
              <P><C>[TO DECIDE, with a lawyer: limit of liability, warranty disclaimer, governing law and the court that decides disputes]</C></P>
            </>
          ),
        },
        {
          id: 'changes',
          title: '10. Changes and contact',
          body: (
            <>
              <P>We may change these terms. We will change the date at the top of this page and, for important changes, tell account holders. Using the site after a change means you accept it.</P>
              <P>Contact: <C>[TO DECIDE: contact email address]</C>. You can also use Report a problem when you are logged in.</P>
            </>
          ),
        },
      ]}
    />
  );
}
