// Code samples shown on /docs, shared by the English and Thai versions. They are code, so they are not translated.
export const COMPONENT_SAMPLE = `<script type="module" src="https://YOUR_SITE/embed.js"></script>

<vm-model
  model-id="MODEL_ID"
  cdn-base="https://YOUR_CDN"
  auto-rotate
  camera-controls
></vm-model>`;

export const IFRAME_SAMPLE = `<iframe
  src="https://YOUR_SITE/embed/MODEL_ID"
  width="600"
  height="400"
  loading="lazy"
  allow="fullscreen"
  style="border:0"
></iframe>`;

export const STYLE_SAMPLE = `<vm-model
  model-id="MODEL_ID"
  cdn-base="https://YOUR_CDN"
  style="--vm-width: 100%; --vm-height: 480px; --vm-bg: #0b0d10"
></vm-model>`;

export const PAID_SAMPLE = `<vm-model
  model-id="MODEL_ID"
  cdn-base="https://YOUR_CDN"
  key="YOUR_EMBED_KEY"
  auto-rotate
  camera-controls
></vm-model>`;
