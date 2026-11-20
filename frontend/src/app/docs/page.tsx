// /docs — how to embed, buy, download and sell models on Lixyte
import type { Metadata } from 'next';
import Link from 'next/link';
import CodeBlock from '@/components/content/CodeBlock';
import DocLayout from '@/components/content/DocLayout';
import { getT } from '@/lib/i18n/server';
import { COMPONENT_SAMPLE, IFRAME_SAMPLE, PAID_SAMPLE, STYLE_SAMPLE } from './samples';
import DocsTh from './th';
import { C, Callout, DataTable, H3, OL, P, PageHeader, Section, UL } from '@/components/content/prose';

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getT();
  return locale === 'th'
    ? { title: 'เอกสาร · Lixyte', description: 'วิธีใส่โมเดล 3D จาก Lixyte บนเว็บไซต์ใดก็ได้ด้วยโค้ดบรรทัดเดียว embed key ทำงานอย่างไร และวิธีขายโมเดลของคุณเอง' }
    : { title: 'Docs · Lixyte', description: 'How to put a Lixyte 3D model on any website with one line of code, how embed keys work, and how to sell your own models.' };
}

const TOC = [
  { id: 'quick-start', title: 'Quick start' },
  { id: 'web-component', title: 'The <vm-model> element' },
  { id: 'iframe', title: 'The iframe' },
  { id: 'paid-models', title: 'Paid models and embed keys' },
  { id: 'download', title: 'Downloading a file' },
  { id: 'selling', title: 'Selling a model' },
  { id: 'cdn', title: 'CDN addresses' },
  { id: 'troubleshooting', title: 'Troubleshooting' },
  { id: 'help', title: 'Still stuck?' },
];

export default async function DocsPage() {
  const { locale } = await getT();
  return locale === 'th' ? <DocsTh /> : <DocsEn />;
}

function DocsEn() {
  return (
    <main className="mx-auto max-w-[1400px] px-4 pb-16 pt-24 md:px-6">
      <PageHeader
        label="Docs"
        title="Docs"
        intro="Lixyte is a library of 3D models (.glb files) that you can show on any website with one line of code. We store the file and stream it from our CDN, so you host nothing."
      />

      <DocLayout toc={TOC}>
        <Section id="quick-start" title="Quick start">
          <OL>
            <li>Find a model in the <Link href="/gallery" className="text-ink underline underline-offset-4">gallery</Link> and open its page.</li>
            <li>Copy the code from the <strong className="font-medium text-ink">How to use</strong> box. It already contains the right addresses for this site.</li>
            <li>Paste it into your page. The model loads from our CDN.</li>
          </OL>
          <P>
            Below is what that code looks like. Replace <C>YOUR_SITE</C> with the address of this website, <C>YOUR_CDN</C> with the address
            of the CDN and <C>MODEL_ID</C> with the id in the model page address.
          </P>
          <CodeBlock label="<vm-model> web component" code={COMPONENT_SAMPLE} />
          <Callout title="Free models need nothing else">
            A free model works as soon as you paste the code. Paid models also need an embed key, see{' '}
            <a href="#paid-models" className="text-ink underline underline-offset-4">Paid models and embed keys</a>.
          </Callout>
        </Section>

        <Section id="web-component" title="The <vm-model> element">
          <P>
            Load <C>embed.js</C> once per page, then use <C>&lt;vm-model&gt;</C> wherever you want a model. It wraps Google&apos;s{' '}
            <C>&lt;model-viewer&gt;</C>, so the viewer, controls and touch gestures work on phones too.
          </P>
          <DataTable
            caption="Attributes of the vm-model element"
            head={['Attribute', 'What it does', 'Default']}
            rows={[
              [<C key="a">model-id</C>, 'The id of the model. Required.', '—'],
              [<C key="a">cdn-base</C>, 'Address of the CDN. Always set it outside local development.', <C key="d">http://localhost:4001</C>],
              [<C key="a">key</C>, 'Your embed key. Only for paid models.', 'none (shows the preview file)'],
              [<C key="a">auto-rotate</C>, 'Turns the model slowly by itself.', 'off'],
              [<C key="a">camera-controls</C>, 'Lets visitors drag to rotate and pinch or scroll to zoom.', 'off'],
              [<C key="a">background</C>, 'A CSS colour behind the model.', 'transparent'],
              [<C key="a">exposure</C>, 'Brightness of the lighting, as a number.', '1'],
              [<C key="a">shadow-intensity</C>, 'Strength of the soft shadow under the model.', '0'],
              [<C key="a">poster</C>, 'An image shown while the 3D file loads.', 'the model poster'],
              [<C key="a">loading</C>, <span key="t"><C>lazy</C> loads when the element scrolls into view, <C>eager</C> loads at once.</span>, <C key="d">lazy</C>],
            ]}
          />
          <H3>Size and background</H3>
          <P>Use these CSS variables on the element to set its size and background:</P>
          <CodeBlock label="Size and background" code={STYLE_SAMPLE} />
          <UL>
            <li><C>--vm-width</C> is the width (default <C>100%</C>).</li>
            <li><C>--vm-height</C> is the height (default <C>400px</C>).</li>
            <li><C>--vm-bg</C> is the background colour (default transparent).</li>
          </UL>
        </Section>

        <Section id="iframe" title="The iframe">
          <P>
            If you cannot load scripts (some website builders block them), use an iframe instead. It shows the same viewer on a page of
            ours, and we allow any website to embed it.
          </P>
          <CodeBlock label="iframe" code={IFRAME_SAMPLE} />
          <P>
            For a paid model add your key to the address: <C>https://YOUR_SITE/embed/MODEL_ID?key=YOUR_EMBED_KEY</C>.
          </P>
          <P>
            The few messages of the viewer (loading, "preview only") are in English by default. Add <C>&amp;lang=th</C> to the address for Thai.
          </P>
        </Section>

        <Section id="paid-models" title="Paid models and embed keys">
          <P>
            Before you buy, a paid model streams only a short <strong className="font-medium text-ink">preview file</strong>. The full file
            never leaves our servers without a valid key.
          </P>
          <OL>
            <li>Buy the model. You get an <strong className="font-medium text-ink">embed key</strong>, shown in your <Link href="/me" className="text-ink underline underline-offset-4">Library</Link>.</li>
            <li>Add it to the code: the <C>key</C> attribute on <C>&lt;vm-model&gt;</C>, or <C>?key=</C> on the iframe address.</li>
          </OL>
          <CodeBlock label="Paid model" code={PAID_SAMPLE} />
          <H3>If the key is wrong or has been replaced</H3>
          <P>
            The page does not break. The viewer falls back to the preview file and shows a notice that you need a valid key. You can create
            a new key at any time in your Library; the old key stops working immediately.
          </P>
          <Callout title="Treat the key like a password">
            The key is part of the code on your page, so anyone who views your page source can read it. If you think it leaked, create a new
            key in your Library and update your page.
          </Callout>
        </Section>

        <Section id="download" title="Downloading a file">
          <UL>
            <li><strong className="font-medium text-ink">Free models:</strong> anyone can download them, with no account.</li>
            <li><strong className="font-medium text-ink">Paid models:</strong> log in with the account that bought the model (or the account that owns it).</li>
            <li>
              Every file you download from a paid model carries a hidden mark that records your purchase and licence. Please do not remove it or
              share the file; see the <Link href="/licenses" className="text-ink underline underline-offset-4">licenses</Link> and the{' '}
              <Link href="/terms" className="text-ink underline underline-offset-4">terms</Link>.
            </li>
          </UL>
        </Section>

        <Section id="selling" title="Selling a model">
          <OL>
            <li>Log in and turn on <strong className="font-medium text-ink">seller mode</strong> in your <Link href="/me" className="text-ink underline underline-offset-4">Library</Link>. It is the same account; nothing else changes.</li>
            <li>Open <Link href="/upload" className="text-ink underline underline-offset-4">Upload</Link>, choose your <C>.glb</C> file and fill in the title, description, tags, licence and price. A price of 0 means free.</li>
            <li>Your model appears in the gallery. Follow sales and downloads in your <Link href="/seller" className="text-ink underline underline-offset-4">Seller dashboard</Link>.</li>
          </OL>
          <DataTable
            caption="Upload limits"
            head={['File', 'Rule']}
            rows={[
              ['Main file', <span key="a"><C>.glb</C> (binary glTF 2.0), up to 50 MB.</span>],
              ['Preview file', 'Up to 5 MB. Required for paid models: this is all that visitors see before they buy.'],
              ['Cover image', 'Up to 1 MB (.webp, .png or .jpg). The upload page can capture it from the 3D view for you.'],
            ]}
          />
          <UL>
            <li>We check every file before it is saved. A file that is not a valid <C>.glb</C> is rejected.</li>
            <li>We mark every uploaded file with a hidden signature that identifies the model, and mark each paid download with the buyer&apos;s purchase.</li>
            <li>Removing a model hides it from the gallery. People who already bought it keep their access.</li>
            <li>The admins can hide a model or suspend an account that breaks the rules. A hidden model stops working for everyone, including buyers. See the <Link href="/seller-terms" className="text-ink underline underline-offset-4">seller terms</Link>.</li>
          </UL>
        </Section>

        <Section id="cdn" title="CDN addresses">
          <P>These addresses are what the web component and the iframe call for you. You only need them if you build your own viewer.</P>
          <DataTable
            caption="CDN addresses"
            head={['Address', 'What it returns']}
            rows={[
              [<C key="a">/cdn/models/MODEL_ID/preview.glb</C>, 'The public file: the whole file for a free model, the preview file for a paid one.'],
              [<C key="a">/cdn/models/MODEL_ID/file.glb?key=KEY</C>, 'The full file of a paid model, for a valid embed key.'],
              [<C key="a">/cdn/models/MODEL_ID/poster.webp</C>, 'The cover image.'],
              [<C key="a">/cdn/models/MODEL_ID/download</C>, 'A download with the file name set. Paid models need the buyer to be logged in.'],
            ]}
          />
          <UL>
            <li>The server supports partial downloads (HTTP Range) and caching, so large models start quickly and repeat visits are fast.</li>
            <li>Too many wrong keys in a row are slowed down with a rate limit.</li>
            <li>
              Errors come back as JSON: <C>{`{ "error": { "code": "...", "message": "..." } }`}</C>. Common codes are{' '}
              <C>KEY_REQUIRED</C> (a paid file needs a key), <C>MODEL_NOT_FOUND</C> and <C>MODEL_UNAVAILABLE</C> (the model was hidden by an admin
              or its owner was suspended).
            </li>
          </UL>
        </Section>

        <Section id="troubleshooting" title="Troubleshooting">
          <H3>The box is empty or shows an image only</H3>
          <UL>
            <li>Check that <C>cdn-base</C> points to the CDN (not to this website) and that the page can reach it.</li>
            <li>Check the <C>model-id</C>. A removed or hidden model cannot be shown.</li>
            <li>The viewer needs WebGL. Very old browsers and some locked-down devices do not have it.</li>
          </UL>
          <H3>It says I need to buy the model, but I did</H3>
          <P>The key is missing, mistyped or was replaced. Copy the current key from your Library.</P>
          <H3>I cannot download a paid model</H3>
          <P>You must be logged in with the account that bought it. A purchase that was started but not paid does not count.</P>
          <H3>A model I used disappeared</H3>
          <P>An admin hid it, or its owner&apos;s account was suspended. Contact us with the model address and we will tell you what happened.</P>
        </Section>

        <Section id="help" title="Still stuck?">
          <P>
            Log in and use <strong className="font-medium text-ink">Report a problem</strong> in the account menu or at the bottom of any page. Choose
            the type, paste the model address if there is one, and tell us what happened.
          </P>
        </Section>
      </DocLayout>
    </main>
  );
}
