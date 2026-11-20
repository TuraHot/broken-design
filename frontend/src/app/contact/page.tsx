// /contact — where to send what. Problems go through the report popup; there is no public mailbox decided yet.
import type { Metadata } from 'next';
import Link from 'next/link';
import ReportButton from '@/components/content/ReportButton';
import { Callout, P, PageHeader, Section, UL } from '@/components/content/prose';
import { getT } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getT();
  return locale === 'th'
    ? { title: 'ติดต่อเรา · Lixyte', description: 'ช่องทางติดต่อทีม Lixyte: แจ้งปัญหา สอบถามสัญญาอนุญาต หรือขอให้ลบงานละเมิดลิขสิทธิ์' }
    : { title: 'Contact · Lixyte', description: 'How to reach the Lixyte team: report a problem, ask about a license, or request a takedown.' };
}

const LINK = 'text-ink underline underline-offset-4';

export default async function ContactPage() {
  const { t } = await getT();
  return (
    <main className="mx-auto max-w-[1400px] px-4 pb-16 pt-24 md:px-6">
      <PageHeader label={t('contact.label')} title={t('contact.title')} intro={t('contact.intro')} />

      <div className="mt-10 grid max-w-[72ch] grid-cols-[minmax(0,1fr)] gap-12">
        <Section id="problem" title={t('contact.problem.title')}>
          <P>{t('contact.problem.body')}</P>
          <div>
            <ReportButton>{t('contact.problem.title')}</ReportButton>
          </div>
        </Section>

        <Section id="copyright" title={t('contact.copyright.title')}>
          <P>
            {t('contact.copyright.before')}{' '}
            <Link href="/dmca" className={LINK}>{t('contact.copyright.link')}</Link>
            {t('contact.copyright.after')}
          </P>
        </Section>

        <Section id="help" title={t('contact.help.title')}>
          <UL>
            <li>{t('contact.help.docs')} <Link href="/docs" className={LINK}>{t('footer.docs')}</Link></li>
            <li>{t('contact.help.licenses')} <Link href="/licenses" className={LINK}>{t('footer.licenses')}</Link></li>
            <li>{t('contact.help.refunds')} <Link href="/refunds" className={LINK}>{t('legal.refunds')}</Link></li>
          </UL>
        </Section>

        <Callout title={t('contact.email.title')}>{t('contact.email.body')}</Callout>
      </div>
    </main>
  );
}
