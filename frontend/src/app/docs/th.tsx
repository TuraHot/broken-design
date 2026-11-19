// /docs in Thai. Same structure as the English page; code samples and attribute names stay in English.
import Link from 'next/link';
import CodeBlock from '@/components/content/CodeBlock';
import DocLayout from '@/components/content/DocLayout';
import { C, Callout, DataTable, H3, OL, P, PageHeader, Section, UL } from '@/components/content/prose';
import { COMPONENT_SAMPLE, IFRAME_SAMPLE, PAID_SAMPLE, STYLE_SAMPLE } from './samples';

const TOC = [
  { id: 'quick-start', title: 'เริ่มต้นใช้งานเร็ว' },
  { id: 'web-component', title: 'องค์ประกอบ <vm-model>' },
  { id: 'iframe', title: 'iframe' },
  { id: 'paid-models', title: 'โมเดลแบบเสียเงินและ embed key' },
  { id: 'download', title: 'การดาวน์โหลดไฟล์' },
  { id: 'selling', title: 'การขายโมเดล' },
  { id: 'cdn', title: 'ที่อยู่ของ CDN' },
  { id: 'troubleshooting', title: 'แก้ปัญหาเบื้องต้น' },
  { id: 'help', title: 'ยังแก้ไม่ได้?' },
];

const A = 'text-white underline underline-offset-4';
const B = 'font-medium text-white/80';

export default function DocsTh() {
  return (
    <main className="mx-auto max-w-[1400px] px-4 pb-16 pt-24 md:px-6">
      <PageHeader
        label="เอกสาร"
        title="เอกสาร"
        intro="Lixyte คือคลังโมเดล 3D (ไฟล์ .glb) ที่คุณนำไปแสดงบนเว็บไซต์ใดก็ได้ด้วยโค้ดบรรทัดเดียว เราเก็บไฟล์และส่งผ่าน CDN ของเรา คุณจึงไม่ต้องโฮสต์เอง"
      />

      <DocLayout toc={TOC}>
        <Section id="quick-start" title="เริ่มต้นใช้งานเร็ว">
          <OL>
            <li>เลือกโมเดลใน<Link href="/gallery" className={A}>แกลเลอรี</Link>แล้วเปิดหน้าของโมเดลนั้น</li>
            <li>คัดลอกโค้ดจากกล่อง <strong className={B}>How to use</strong> ซึ่งมีที่อยู่ที่ถูกต้องของเว็บไซต์นี้อยู่แล้ว</li>
            <li>วางลงในหน้าเว็บของคุณ โมเดลจะโหลดจาก CDN ของเรา</li>
          </OL>
          <P>
            ด้านล่างคือตัวอย่างหน้าตาของโค้ดนั้น ให้แทน <C>YOUR_SITE</C> ด้วยที่อยู่ของเว็บไซต์นี้ แทน <C>YOUR_CDN</C> ด้วยที่อยู่ของ CDN
            และแทน <C>MODEL_ID</C> ด้วยรหัสโมเดลในที่อยู่ของหน้าโมเดล
          </P>
          <CodeBlock label="<vm-model> web component" code={COMPONENT_SAMPLE} />
          <Callout title="โมเดลฟรีไม่ต้องตั้งค่าอะไรเพิ่ม">
            โมเดลฟรีใช้งานได้ทันทีที่วางโค้ด ส่วนโมเดลแบบเสียเงินต้องมี embed key ด้วย ดู{' '}
            <a href="#paid-models" className={A}>โมเดลแบบเสียเงินและ embed key</a>
          </Callout>
        </Section>

        <Section id="web-component" title="องค์ประกอบ <vm-model>">
          <P>
            โหลด <C>embed.js</C> หนึ่งครั้งต่อหน้า แล้วใช้ <C>&lt;vm-model&gt;</C> ตรงที่ต้องการแสดงโมเดล องค์ประกอบนี้ห่อ{' '}
            <C>&lt;model-viewer&gt;</C> ของ Google ไว้ ตัวแสดงผล ปุ่มควบคุม และการสัมผัสจึงใช้ได้บนมือถือด้วย
          </P>
          <DataTable
            caption="แอตทริบิวต์ขององค์ประกอบ vm-model"
            head={['แอตทริบิวต์', 'หน้าที่', 'ค่าเริ่มต้น']}
            rows={[
              [<C key="a">model-id</C>, 'รหัสของโมเดล จำเป็นต้องใส่', '—'],
              [<C key="a">cdn-base</C>, 'ที่อยู่ของ CDN ควรกำหนดเสมอเมื่อไม่ได้ใช้งานในเครื่องตัวเอง', <C key="d">http://localhost:4001</C>],
              [<C key="a">key</C>, 'embed key ของคุณ ใช้กับโมเดลแบบเสียเงินเท่านั้น', 'ไม่มี (แสดงไฟล์พรีวิว)'],
              [<C key="a">auto-rotate</C>, 'หมุนโมเดลช้า ๆ เอง', 'ปิด'],
              [<C key="a">camera-controls</C>, 'ให้ผู้เข้าชมลากเพื่อหมุน และบีบหรือเลื่อนเพื่อซูม', 'ปิด'],
              [<C key="a">background</C>, 'สี CSS ด้านหลังโมเดล', 'โปร่งใส'],
              [<C key="a">exposure</C>, 'ความสว่างของแสง เป็นตัวเลข', '1'],
              [<C key="a">shadow-intensity</C>, 'ความเข้มของเงานุ่ม ๆ ใต้โมเดล', '0'],
              [<C key="a">poster</C>, 'รูปที่แสดงระหว่างรอโหลดไฟล์ 3D', 'โปสเตอร์ของโมเดล'],
              [<C key="a">loading</C>, <span key="t"><C>lazy</C> โหลดเมื่อเลื่อนมาถึง <C>eager</C> โหลดทันที</span>, <C key="d">lazy</C>],
            ]}
          />
          <H3>ขนาดและพื้นหลัง</H3>
          <P>ใช้ตัวแปร CSS เหล่านี้กับองค์ประกอบเพื่อกำหนดขนาดและพื้นหลัง:</P>
          <CodeBlock label="ขนาดและพื้นหลัง" code={STYLE_SAMPLE} />
          <UL>
            <li><C>--vm-width</C> คือความกว้าง (ค่าเริ่มต้น <C>100%</C>)</li>
            <li><C>--vm-height</C> คือความสูง (ค่าเริ่มต้น <C>400px</C>)</li>
            <li><C>--vm-bg</C> คือสีพื้นหลัง (ค่าเริ่มต้นคือโปร่งใส)</li>
          </UL>
        </Section>

        <Section id="iframe" title="iframe">
          <P>
            หากโหลดสคริปต์ไม่ได้ (บางเครื่องมือสร้างเว็บไซต์บล็อกสคริปต์) ให้ใช้ iframe แทน จะแสดงตัวแสดงผลเดียวกันจากหน้าของเรา
            และเราอนุญาตให้ทุกเว็บไซต์ฝังได้
          </P>
          <CodeBlock label="iframe" code={IFRAME_SAMPLE} />
          <P>
            สำหรับโมเดลแบบเสียเงิน ให้เพิ่ม key ต่อท้ายที่อยู่: <C>https://YOUR_SITE/embed/MODEL_ID?key=YOUR_EMBED_KEY</C>
          </P>
          <P>
            ข้อความไม่กี่ข้อของตัวแสดงผล (กำลังโหลด, "แสดงเฉพาะตัวอย่าง") เป็นภาษาอังกฤษโดยปริยาย ต่อท้ายที่อยู่ด้วย <C>&amp;lang=th</C> เพื่อให้เป็นภาษาไทย
          </P>
        </Section>

        <Section id="paid-models" title="โมเดลแบบเสียเงินและ embed key">
          <P>
            ก่อนซื้อ โมเดลแบบเสียเงินจะส่งเพียง<strong className={B}>ไฟล์พรีวิว</strong>สั้น ๆ เท่านั้น ไฟล์เต็มจะไม่ออกจากเซิร์ฟเวอร์ของเรา
            หากไม่มี key ที่ถูกต้อง
          </P>
          <OL>
            <li>ซื้อโมเดล คุณจะได้ <strong className={B}>embed key</strong> ซึ่งแสดงอยู่ใน<Link href="/me" className={A}>คลังของฉัน</Link></li>
            <li>ใส่ลงในโค้ด: แอตทริบิวต์ <C>key</C> บน <C>&lt;vm-model&gt;</C> หรือ <C>?key=</C> ท้ายที่อยู่ของ iframe</li>
          </OL>
          <CodeBlock label="โมเดลแบบเสียเงิน" code={PAID_SAMPLE} />
          <H3>ถ้า key ผิดหรือถูกเปลี่ยนไปแล้ว</H3>
          <P>
            หน้าเว็บจะไม่พัง ตัวแสดงผลจะกลับไปใช้ไฟล์พรีวิวและแจ้งว่าต้องมี key ที่ถูกต้อง คุณสร้าง key ใหม่ได้ทุกเมื่อในคลังของฉัน
            key เดิมจะใช้ไม่ได้ทันที
          </P>
          <Callout title="ดูแล key เหมือนรหัสผ่าน">
            key เป็นส่วนหนึ่งของโค้ดบนหน้าเว็บของคุณ ทุกคนที่ดูซอร์สของหน้าจึงอ่านได้ หากคิดว่า key รั่ว ให้สร้าง key ใหม่ในคลังของฉัน
            แล้วแก้หน้าเว็บของคุณ
          </Callout>
        </Section>

        <Section id="download" title="การดาวน์โหลดไฟล์">
          <UL>
            <li><strong className={B}>โมเดลฟรี:</strong> ทุกคนดาวน์โหลดได้ โดยไม่ต้องมีบัญชี</li>
            <li><strong className={B}>โมเดลแบบเสียเงิน:</strong> เข้าสู่ระบบด้วยบัญชีที่ซื้อโมเดลนั้น (หรือบัญชีเจ้าของโมเดล)</li>
            <li>
              ทุกไฟล์ที่ดาวน์โหลดจากโมเดลแบบเสียเงินมีเครื่องหมายซ่อนอยู่ ซึ่งบันทึกการซื้อและสัญญาอนุญาตของคุณ กรุณาอย่าลบเครื่องหมายหรือแชร์ไฟล์
              ดู<Link href="/licenses" className={A}>สัญญาอนุญาต</Link>และ<Link href="/terms" className={A}>ข้อกำหนด</Link>
            </li>
          </UL>
        </Section>

        <Section id="selling" title="การขายโมเดล">
          <OL>
            <li>เข้าสู่ระบบ แล้วเปิด<strong className={B}>โหมดผู้ขาย</strong>ใน<Link href="/me" className={A}>คลังของฉัน</Link> ยังเป็นบัญชีเดิม ไม่มีอะไรอื่นเปลี่ยน</li>
            <li>เปิดหน้า<Link href="/upload" className={A}>อัปโหลด</Link> เลือกไฟล์ <C>.glb</C> แล้วกรอกชื่อ คำอธิบาย แท็ก สัญญาอนุญาต และราคา ราคา 0 หมายถึงฟรี</li>
            <li>โมเดลของคุณจะขึ้นในแกลเลอรี ติดตามยอดขายและการดาวน์โหลดได้ใน<Link href="/seller" className={A}>แดชบอร์ดผู้ขาย</Link></li>
          </OL>
          <DataTable
            caption="ข้อจำกัดการอัปโหลด"
            head={['ไฟล์', 'กฎ']}
            rows={[
              ['ไฟล์หลัก', <span key="a"><C>.glb</C> (binary glTF 2.0) ขนาดไม่เกิน 50 MB</span>],
              ['ไฟล์พรีวิว', 'ขนาดไม่เกิน 5 MB จำเป็นสำหรับโมเดลแบบเสียเงิน เพราะนี่คือทั้งหมดที่ผู้เข้าชมเห็นก่อนซื้อ'],
              ['รูปปก', 'ขนาดไม่เกิน 1 MB (.webp, .png หรือ .jpg) หน้าอัปโหลดสามารถจับภาพจากมุมมอง 3D ให้ได้'],
            ]}
          />
          <UL>
            <li>เราตรวจทุกไฟล์ก่อนบันทึก ไฟล์ที่ไม่ใช่ <C>.glb</C> ที่ถูกต้องจะถูกปฏิเสธ</li>
            <li>เราใส่ลายเซ็นซ่อนในทุกไฟล์ที่อัปโหลดเพื่อระบุว่าเป็นโมเดลใด และใส่เครื่องหมายการซื้อของผู้ซื้อในทุกการดาวน์โหลดแบบเสียเงิน</li>
            <li>การลบโมเดลจะซ่อนโมเดลจากแกลเลอรี ผู้ที่ซื้อไปแล้วยังใช้งานได้ต่อ</li>
            <li>ผู้ดูแลสามารถซ่อนโมเดลหรือระงับบัญชีที่ฝ่าฝืนกฎ โมเดลที่ถูกซ่อนจะใช้งานไม่ได้สำหรับทุกคน รวมถึงผู้ซื้อ ดู<Link href="/seller-terms" className={A}>ข้อกำหนดสำหรับผู้ขาย</Link></li>
          </UL>
        </Section>

        <Section id="cdn" title="ที่อยู่ของ CDN">
          <P>ที่อยู่เหล่านี้คือสิ่งที่ web component และ iframe เรียกใช้ให้คุณ คุณต้องใช้เองก็ต่อเมื่อสร้างตัวแสดงผลของตัวเอง</P>
          <DataTable
            caption="ที่อยู่ของ CDN"
            head={['ที่อยู่', 'สิ่งที่ส่งกลับ']}
            rows={[
              [<C key="a">/cdn/models/MODEL_ID/preview.glb</C>, 'ไฟล์สาธารณะ: ไฟล์เต็มสำหรับโมเดลฟรี หรือไฟล์พรีวิวสำหรับโมเดลแบบเสียเงิน'],
              [<C key="a">/cdn/models/MODEL_ID/file.glb?key=KEY</C>, 'ไฟล์เต็มของโมเดลแบบเสียเงิน เมื่อใช้ embed key ที่ถูกต้อง'],
              [<C key="a">/cdn/models/MODEL_ID/poster.webp</C>, 'รูปปก'],
              [<C key="a">/cdn/models/MODEL_ID/download</C>, 'การดาวน์โหลดพร้อมกำหนดชื่อไฟล์ โมเดลแบบเสียเงินต้องให้ผู้ซื้อเข้าสู่ระบบ'],
            ]}
          />
          <UL>
            <li>เซิร์ฟเวอร์รองรับการดาวน์โหลดบางส่วน (HTTP Range) และการแคช โมเดลขนาดใหญ่จึงเริ่มแสดงได้เร็ว และการเข้าชมซ้ำก็เร็ว</li>
            <li>การใส่ key ผิดติดกันหลายครั้งจะถูกจำกัดความเร็ว (rate limit)</li>
            <li>
              ข้อผิดพลาดจะส่งกลับเป็น JSON: <C>{`{ "error": { "code": "...", "message": "..." } }`}</C> รหัสที่พบบ่อยคือ{' '}
              <C>KEY_REQUIRED</C> (ไฟล์แบบเสียเงินต้องมี key), <C>MODEL_NOT_FOUND</C> และ <C>MODEL_UNAVAILABLE</C> (โมเดลถูกผู้ดูแลซ่อน
              หรือเจ้าของถูกระงับบัญชี)
            </li>
          </UL>
        </Section>

        <Section id="troubleshooting" title="แก้ปัญหาเบื้องต้น">
          <H3>กล่องว่างเปล่า หรือแสดงเป็นรูปภาพอย่างเดียว</H3>
          <UL>
            <li>ตรวจว่า <C>cdn-base</C> ชี้ไปที่ CDN (ไม่ใช่เว็บไซต์นี้) และหน้าเว็บของคุณเข้าถึงได้</li>
            <li>ตรวจ <C>model-id</C> โมเดลที่ถูกลบหรือถูกซ่อนจะแสดงไม่ได้</li>
            <li>ตัวแสดงผลต้องใช้ WebGL เบราว์เซอร์เก่ามากและอุปกรณ์ที่ล็อกไว้บางเครื่องไม่มี</li>
          </UL>
          <H3>ขึ้นว่าต้องซื้อโมเดล ทั้งที่ซื้อแล้ว</H3>
          <P>key หายไป พิมพ์ผิด หรือถูกเปลี่ยนใหม่ ให้คัดลอก key ปัจจุบันจากคลังของฉัน</P>
          <H3>ดาวน์โหลดโมเดลแบบเสียเงินไม่ได้</H3>
          <P>ต้องเข้าสู่ระบบด้วยบัญชีที่ซื้อโมเดลนั้น การซื้อที่เริ่มแล้วแต่ยังไม่ชำระเงินไม่นับ</P>
          <H3>โมเดลที่ใช้อยู่หายไป</H3>
          <P>ผู้ดูแลซ่อนโมเดลนั้น หรือบัญชีเจ้าของถูกระงับ ติดต่อเราพร้อมที่อยู่ของหน้าโมเดล แล้วเราจะแจ้งว่าเกิดอะไรขึ้น</P>
        </Section>

        <Section id="help" title="ยังแก้ไม่ได้?">
          <P>
            เข้าสู่ระบบแล้วเลือก<strong className={B}>แจ้งปัญหา</strong>ในเมนูบัญชีหรือที่ท้ายทุกหน้า เลือกประเภทเรื่อง วางที่อยู่ของโมเดล (ถ้ามี)
            แล้วบอกเราว่าเกิดอะไรขึ้น
          </P>
        </Section>
      </DocLayout>
    </main>
  );
}
