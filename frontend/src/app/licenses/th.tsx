// /licenses in Thai. Same structure as the English page.
import Link from 'next/link';
import { Check, X } from 'lucide-react';
import DocLayout from '@/components/content/DocLayout';
import { C, Callout, DataTable, OL, P, PageHeader, Section, UL } from '@/components/content/prose';
import { LICENSE_INFO_TH } from '@/lib/licenses';
import { LICENSES } from '@/lib/types';
import { MATRIX, type Cell } from './matrix';

const TOC = [
  { id: 'overview', title: 'สัญญาอนุญาตทั้งสี่แบบ' },
  { id: 'compare', title: 'เปรียบเทียบในพริบตา' },
  { id: 'credit', title: 'วิธีให้เครดิตผู้สร้าง' },
  { id: 'buying', title: 'เมื่อคุณซื้อโมเดล' },
  { id: 'choosing', title: 'การเลือกแบบสำหรับครีเอเตอร์' },
];

const A = 'text-white underline underline-offset-4';

function Mark({ value }: { value: Cell }) {
  if (value === 'yes' || value === 'credit') {
    return (
      <span className="inline-flex items-center gap-1.5 text-white/80">
        <Check aria-hidden className="h-4 w-4 text-emerald-400" />
        {value === 'yes' ? 'ได้' : 'ได้ โดยให้เครดิต'}
      </span>
    );
  }
  if (value === 'no') {
    return (
      <span className="inline-flex items-center gap-1.5 text-white/80">
        <X aria-hidden className="h-4 w-4 text-red-300" />
        ไม่ได้
      </span>
    );
  }
  return <span className="text-white/65">ยังไม่กำหนด*</span>;
}

export default function LicensesTh() {
  return (
    <main className="mx-auto max-w-[1400px] px-4 pb-16 pt-24 md:px-6">
      <PageHeader
        label="สัญญาอนุญาต"
        title="สัญญาอนุญาตของโมเดล"
        intro={
          <>
            ทุกโมเดลบน Lixyte มีสัญญาอนุญาตหนึ่งแบบ แสดงเป็นป้ายบนการ์ดโมเดลและอธิบายในหน้าโมเดล หน้านี้อธิบายเรื่องเดียวกันด้วยภาษาง่าย ๆ ในที่เดียว
            ทั้งหมดเป็นการสรุป ไม่ใช่ข้อความทางกฎหมาย สิ่งที่มีผลจริงคือ<Link href="/terms" className={A}>ข้อกำหนดการใช้งาน</Link>และสัญญาอนุญาตของแต่ละโมเดล
          </>
        }
      />

      <DocLayout toc={TOC}>
        <Section id="overview" title="สัญญาอนุญาตทั้งสี่แบบ">
          <div className="grid gap-4 sm:grid-cols-2">
            {LICENSES.map((lic) => {
              const info = LICENSE_INFO_TH[lic];
              return (
                <article key={lic} className="rounded-lg border border-white/10 bg-white/5 p-5">
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-hud">{lic}</p>
                  <h3 className="mt-2 text-[15px] font-medium text-white">{info.name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/65">{info.summary}</p>
                  <ul className="mt-4 grid gap-2 text-sm">
                    {info.rules.map((r) => (
                      <li key={r.text} className="flex items-start gap-2 text-white/80">
                        {r.ok ? (
                          <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                        ) : (
                          <X aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
                        )}
                        <span>
                          <span className="sr-only">{r.ok ? 'ทำได้: ' : 'ทำไม่ได้: '}</span>
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

        <Section id="compare" title="เปรียบเทียบในพริบตา">
          <DataTable
            caption="สิ่งที่สัญญาอนุญาตแต่ละแบบอนุญาต"
            head={['สัญญาอนุญาต', 'ใช้เชิงพาณิชย์', 'ดัดแปลง', 'ให้เครดิตผู้สร้าง', 'แชร์ไฟล์']}
            rows={LICENSES.map((lic) => [
              LICENSE_INFO_TH[lic].name,
              <Mark key="c" value={MATRIX[lic].commercial} />,
              <Mark key="m" value={MATRIX[lic].modify} />,
              MATRIX[lic].credit === 'credit' ? <span key="cr" className="text-white/80">จำเป็น</span> : <span key="cr">ไม่จำเป็น</span>,
              <Mark key="s" value={MATRIX[lic].resell} />,
            ])}
          />
          <UL>
            <li>ภายใต้ CC BY-NC คุณแชร์ไฟล์ได้เฉพาะเพื่อวัตถุประสงค์ที่ไม่ใช่เชิงพาณิชย์ และต้องให้เครดิตเสมอ</li>
            <li>* แพลตฟอร์มยังไม่ได้กำหนดว่าคุณแก้ไขโมเดลที่ซื้อภายใต้สัญญาอนุญาตเชิงพาณิชย์ได้หรือไม่ ควรถามครีเอเตอร์ก่อน ส่วนการขายหรือส่งต่อไฟล์ไม่ได้รับอนุญาตภายใต้สัญญาอนุญาตเชิงพาณิชย์</li>
          </UL>
          <Callout title="ใช้ได้ฟรี ไม่ได้แปลว่าอัปโหลดได้ฟรี">
            คุณใช้โมเดล CC0 ในงานของคุณเองได้ แต่อัปโหลดขึ้น Lixyte ราวกับเป็นงานของคุณไม่ได้ การอัปโหลดโมเดลที่ไม่ได้สร้างเองหรือไม่มีสิทธิ์แชร์
            ฝ่าฝืน<Link href="/seller-terms" className={A}>ข้อกำหนดสำหรับผู้ขาย</Link>
          </Callout>
        </Section>

        <Section id="credit" title="วิธีให้เครดิตผู้สร้าง">
          <P>สำหรับโมเดล CC BY และ CC BY-NC ให้ใส่เครดิตในที่ที่คนมองเห็น เช่น ท้ายหน้าเว็บหรือหน้าเครดิตของคุณ เครดิตที่ดีมีสี่ส่วน:</P>
          <UL>
            <li>ชื่อของโมเดล</li>
            <li>ชื่อของผู้สร้าง พร้อมลิงก์ไปยังโปรไฟล์บน Lixyte</li>
            <li>สัญญาอนุญาต (เช่น <C>CC BY</C>)</li>
            <li>ลิงก์ไปยังหน้าโมเดลบน Lixyte</li>
          </UL>
          <P>
            ตัวอย่าง: <C>&quot;Spectral Lily&quot; by Mira Okafor, CC BY, from Lixyte</C>
          </P>
        </Section>

        <Section id="buying" title="เมื่อคุณซื้อโมเดล">
          <UL>
            <li>ราคา สกุลเงิน และสัญญาอนุญาตจะถูกกำหนดตายตัว ณ ตอนที่คุณซื้อ หากครีเอเตอร์เปลี่ยนภายหลัง การซื้อของคุณยังคงเป็นเหมือนเดิม</li>
            <li>คุณจะได้ embed key สำหรับแสดงโมเดลบนเว็บไซต์ของคุณเอง และดาวน์โหลดไฟล์ได้ ดู<Link href="/docs" className={A}>เอกสาร</Link></li>
            <li>ไฟล์ที่คุณดาวน์โหลดมีเครื่องหมายซ่อนที่บันทึกการซื้อและสัญญาอนุญาตของคุณ ทำให้เราตามรอยสำเนาที่รั่วไหลกลับไปยังการซื้อได้ การลบเครื่องหมายหรือแชร์ไฟล์ถือว่าฝ่าฝืนสัญญาอนุญาต</li>
            <li>หากผู้ดูแลซ่อนโมเดลหรือระงับบัญชีเจ้าของ โมเดลจะใช้งานไม่ได้สำหรับทุกคน รวมถึงผู้ที่ซื้อไปแล้ว ดู<Link href="/refunds" className={A}>นโยบายการคืนเงิน</Link>ว่าคุณทำอะไรได้บ้างในกรณีนั้น</li>
          </UL>
        </Section>

        <Section id="choosing" title="การเลือกแบบสำหรับครีเอเตอร์">
          <OL>
            <li>ต้องการรายได้จากโมเดลหรือไม่ เลือก <C>COMMERCIAL</C> แล้วตั้งราคา ผู้ซื้อจะได้ไฟล์เต็ม และระบบ embed key ของคุณปกป้องไฟล์</li>
            <li>ต้องการให้ใช้ได้อย่างกว้างขวางโดยไม่มีเงื่อนไข เลือก <C>CC0</C></li>
            <li>ต้องการเครดิตสำหรับผลงาน เลือก <C>CC BY</C></li>
            <li>ต้องการให้ใช้ฟรีสำหรับงานอดิเรกและโครงการโรงเรียน แต่ธุรกิจต้องจ่าย เลือก <C>CC BY-NC</C></li>
          </OL>
          <P>อัปโหลดเฉพาะโมเดลที่คุณสร้างเองหรือมีสิทธิ์แชร์ ดู<Link href="/seller-terms" className={A}>ข้อกำหนดสำหรับผู้ขาย</Link>และ<Link href="/dmca" className={A}>นโยบายลิขสิทธิ์</Link></P>
        </Section>
      </DocLayout>
    </main>
  );
}
