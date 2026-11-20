# Lixyte (Broken Design) — 3D Asset Repository & Cross-Origin WebGL CDN Platform

**Lixyte** (เดิมชื่อ **Broken Design**) คือแพลตฟอร์ม **"คลังโมเดล 3 มิติที่ฝังลงเว็บไซต์ได้ด้วยโค้ดบรรทัดเดียว"** (แนวคิดคล้าย Google Fonts แต่เป็นโมเดล 3 มิติ) — ศูนย์กลางในการจัดเก็บ ค้นหา ซื้อขายรายชิ้น และสตรีมไฟล์โมเดล 3 มิติมาตรฐาน `.glb` (Binary glTF 2.0) ข้ามโดเมน (Cross-Origin CDN) สำหรับนักพัฒนาเว็บและครีเอเตอร์ 3 มิติ

นักพัฒนาเว็บสามารถค้นหาโมเดล ปรับแต่งมุมมองใน Playground แล้วคัดลอกโค้ดเพียง 1–2 บรรทัด (`<vm-model>` Web Component หรือ `<iframe>`) ไปวางบนเว็บไซต์ของตนเองเพื่อให้โมเดลสตรีมจาก CDN ของ Lixyte โดยตรง ไม่ต้องดาวน์โหลด ไม่ต้องตั้งค่า CORS/Cache เอง และไม่ต้องแบกภาระแบนด์วิดท์ของไฟล์ 3 มิติขนาดใหญ่ หรือเลือกดาวน์โหลดไฟล์ `.glb` ที่ฝังใบอนุญาตและลายน้ำดิจิทัล (Multi-Layer Watermark) ไปใช้งานต่อได้ทันที

> 🤖 **สำหรับ AI Coding Agents (Antigravity, Gemini, Claude, Cursor, Copilot, Codex):**
> โปรเจกต์นี้แบ่งหน้าที่เอกสารแบบ **Single Source of Truth** โดยใช้ **[AGENT.md](./AGENT.md)** เป็นแหล่งอ้างอิงหลักด้านความปลอดภัย API/DB Contract และคำสั่งทดสอบ (ร่วมกับ [docs/DESIGN_SYSTEM.md](./docs/DESIGN_SYSTEM.md) สำหรับงาน UI และ [docs/TASKS.md](./docs/TASKS.md) สำหรับสถานะงานรายหน้า) ส่วนไฟล์ [GEMINI.md](./GEMINI.md), [CLAUDE.md](./CLAUDE.md), [AGENTS.md](./AGENTS.md), และ [.agents/rules/mandatory-agent-spec.md](./.agents/rules/mandatory-agent-spec.md) ทำหน้าที่เป็นตัวชี้กฎอัตโนมัติสำหรับเครื่องมือแต่ละตัว (ดูสรุปในหัวข้อ [5.1](#51-สรุปหน้าที่ของไฟล์เอกสาร-md-ในโปรเจกต์-single-source-of-truth))

---

## สารบัญ (Table of Contents)

1. [จุดเด่นและฟีเจอร์หลัก (Key Features)](#1-จุดเด่นและฟีเจอร์หลัก-key-features)
2. [สถาปัตยกรรมระบบ Microservices (System Architecture)](#2-สถาปัตยกรรมระบบ-microservices-system-architecture)
3. [บทบาทผู้ใช้และตารางสิทธิ์การเข้าถึง (Roles & Access Control Matrix)](#3-บทบาทผู้ใช้และตารางสิทธิ์การเข้าถึง-roles--access-control-matrix)
4. [ระบบฝังใบอนุญาตและลายน้ำ 2 ชั้นในไฟล์ .glb (Multi-Layer GLB Watermarking)](#4-ระบบฝังใบอนุญาตและลายน้ำ-2-ชั้นในไฟล์-glb-multi-layer-glb-watermarking)
5. [โครงสร้างโฟลเดอร์โปรเจกต์ (Project Structure)](#5-โครงสร้างโฟลเดอร์โปรเจกต์-project-structure)
6. [รายละเอียด API Endpoints & การฝังโมเดล (API & Embed Reference)](#6-รายละเอียด-api-endpoints--การฝังโมเดล-api--embed-reference)
7. [การแบ่งงานภายในทีมผู้พัฒนา 6 คน (Team Responsibilities)](#7-การแบ่งงานภายในทีมผู้พัฒนา-6-คน-team-responsibilities)
8. [วิธีติดตั้งและเริ่มต้นใช้งาน (Getting Started & Testing)](#8-วิธีติดตั้งและเริ่มต้นใช้งาน-getting-started--testing)

---

## 1. จุดเด่นและฟีเจอร์หลัก (Key Features)

- **Plug-and-Play Cross-Origin 3D Embed:** ฝังโมเดล 3 มิติข้ามโดเมนด้วย Web Component `<vm-model>` (`public/embed.js`) หรือ `<iframe>` (`/embed/[id]`) รองรับการปรับ `auto-rotate`, `camera-controls`, `exposure`, `shadow-intensity` และพื้นหลัง
- **Graceful Preview Fallback:** สำหรับโมเดลเสียเงิน หากไม่ได้ใส่ `embed_key` หรือคีย์ถูกยกเลิก (Regenerate) ตัว Viewer บนเว็บปลายทางจะสลับไปสตรีมไฟล์ตัวอย่าง (`preview.glb`) พร้อมแสดงป้ายแจ้งเตือน `"ต้องซื้อเพื่อใช้งาน"` อัตโนมัติโดยไม่ทำให้หน้าเว็บปลายทางพัง
- **High-Performance 3D CDN Streaming:** รองรับ `HTTP Range Requests` (`206 Partial Content` / `416 Range Not Satisfiable`), `ETag` (`304 Not Modified`), `Cache-Control: immutable` สำหรับไฟล์ที่อ้างอิงด้วย SHA-256 Hash และ `Cross-Origin-Resource-Policy: cross-origin`
- **Single-Item Purchase & Instant Key Regeneration:** ระบบซื้อโมเดลรายชิ้นที่ล็อกราคา (`amount_cents`), สกุลเงิน (`currency`), และประเภทใบอนุญาต (`license_type`) ณ เวลาที่ซื้อ พร้อมสร้าง `embed_key` แบบสุ่มปลอดภัย (`crypto.randomBytes(24)`) ที่ตรวจสอบด้วย Constant-Time (`crypto.timingSafeEqual`) และสามารถกด Regenerate เพื่อตัดสิทธิ์คีย์เก่าได้ทันที
- **Multi-Layer GLB Watermarking (Metadata + Vertex Steganography):** ฝังลายน้ำดิจิทัล 2 ชั้นลงในไฟล์ `.glb` ทั้งตอนอัปโหลดต้นฉบับและตอนผู้ซื้อดาวน์โหลด ช่วยพิสูจน์ความเป็นเจ้าของได้แม้ผู้ไม่หวังดีจะลบ Metadata ออกจากไฟล์แล้วนำไป Export ใหม่
- **Dual-Mode Storage & Database Resilience:** รองรับการจัดเก็บไฟล์แบบ Content-Addressable (`<sha256>.glb`, `<sha256>.webp`) ทั้งบน `LocalDiskStorage` และ `SupabaseStorage` (`models` bucket) พร้อมระบบสลับการเชื่อมต่อฐานข้อมูลระหว่าง PostgreSQL Pool และ Supabase REST API อัตโนมัติ

---

## 2. สถาปัตยกรรมระบบ Microservices (System Architecture)

โปรเจกต์ **Lixyte** แยกส่วน Backend ออกเป็น **2 Microservices** ตามลักษณะการใช้ทรัพยากร เพื่อป้องกันไม่ให้การอัปโหลด ประมวลผลลายน้ำ 3 มิติ และสตรีมไฟล์ `.glb` ขนาดใหญ่กระทบต่อความเร็วของระบบ API หลัก:

```mermaid
flowchart LR
    subgraph Client["ฝั่งผู้ใช้งาน & เว็บไซต์ภายนอก"]
        Browser["Web Browser (Next.js App)"]
        ExtSite["External Website (<vm-model> / <iframe>)"]
    end

    subgraph Services["Lixyte Platform Services"]
        FE["frontend (Port 3000)\nNext.js 15 + @google/model-viewer"]
        API["services/core-api (Port 4000)\nExpress 5: Auth, Catalog, Payments, Seller, Admin"]
        CDN["services/cdn-service (Port 4001)\nExpress 5: Upload, GLB Watermark, Range CDN"]
    end

    subgraph Cloud["Supabase Cloud / Local Storage"]
        DB[("PostgreSQL Database\n(users, models, purchases, likes, comments)")]
        Store[("Object Storage\n(Supabase 'models' bucket & LocalDiskStorage)")]
    end

    Browser --> FE
    Browser --> API
    Browser --> CDN
    ExtSite --> FE
    ExtSite --> CDN
    FE --> API
    FE --> CDN
    API --> DB
    CDN --> DB
    CDN --> Store
```

| เซอร์วิส / โฟลเดอร์ | พอร์ต | เทคโนโลยีหลัก | หน้าที่รับผิดชอบ |
| :--- | :---: | :--- | :--- |
| **`frontend/`** | `3000` | Next.js 15 (App Router), React 19, Tailwind CSS 3, `@google/model-viewer` v4 | หน้าเว็บ Gallery, หน้ารายละเอียด `/models/[id]` + 3D Playground, หน้าอัปโหลด `/upload` (จับภาพ `poster.webp` อัตโนมัติด้วย `.toBlob()`), หน้า `/embed/[id]`, สคริปต์ `public/embed.js` (`<vm-model>`), หน้า `/me`, `/seller`, และ `/admin/*` |
| **`services/core-api/`** | `4000` | Express 5, TypeScript, PostgreSQL (`pg`), JWT, `bcrypt`, `zod` | ระบบสมาชิก (`/api/auth/*`), แคตตาล็อกและการค้นหา (`/api/models/*`), ระบบซื้อรายชิ้นและจัดการ `embed_key` (`/api/models/:id/checkout`, `/api/me/purchases`), ระบบคนขาย (`/api/seller/*`) และระบบแอดมิน (`/api/admin/*`) |
| **`services/cdn-service/`** | `4001` | Express 5, TypeScript, `multer`, `@gltf-transform/core`, `@supabase/supabase-js` | รับอัปโหลดไฟล์ `.glb` (≤ 50 MB), ตรวจ Magic Bytes (`glTF` v2), ฝัง/ตรวจลายน้ำ 2 ชั้น (`glbWatermark.ts`), เก็บไฟล์ด้วย `sha256` และสตรีมผ่าน `/cdn/models/*` (HTTP Range, ETag, CORS, Rate Limit) |
| **`supabase/`** | `5432` | Supabase PostgreSQL & Supabase Storage | ฐานข้อมูลหลัก (`users`, `models`, `purchases`, `likes`, `comments`) และ Cloud Object Storage (`models` bucket) |

---

## 3. บทบาทผู้ใช้และตารางสิทธิ์การเข้าถึง (Roles & Access Control Matrix)

ลูกค้า (ผู้ซื้อ/นักพัฒนาเว็บ) และคนขาย (ครีเอเตอร์) ใช้ **บัญชีเดียวกัน** โดยสามารถกดเปิด "โหมดคนขาย" (`is_seller = true`) เพิ่มเติมได้ทันที ส่วนแอดมินตั้งค่าในฐานข้อมูลเท่านั้นและห้ามซื้อหรือขายโมเดล

| บทบาท | วิธีได้สิทธิ์ | สิทธิ์การใช้งานในระบบ |
| :--- | :--- | :--- |
| **ลูกค้า (Buyer / Dev)** | สมัครสมาชิกปกติ | ค้นหาโมเดลใน Gallery, ปรับแต่งและคัดลอกโค้ดฝัง (`<vm-model>` / `<iframe>`), ซื้อโมเดลรายชิ้น, ดาวน์โหลดไฟล์ `.glb`, จัดการ `embed_key` ในหน้า `/me` |
| **คนขาย (Creator / Seller)** | กดเปิด "โหมดคนขาย" ในบัญชีเดิม | ทุกอย่างของลูกค้า + อัปโหลดโมเดล `.glb` (ฟรีหรือตั้งราคาขาย), ลบโมเดลของตัวเอง (Soft Delete), ดูรายการโมเดลและสรุปยอดขายใน `/seller` |
| **แอดมิน (Admin)** | ตั้งค่า `role = 'admin'` ในฐานข้อมูลเท่านั้น | ดูแลระบบผ่าน `/admin/*`: ดูภาพรวม, ซ่อน/คืนโมเดลที่ละเมิดกฎ (`hidden_at`), ระงับ/คืนบัญชีผู้ใช้ (`suspended_at`), ดูรายการสั่งซื้อทั้งระบบ |

### ตารางสิทธิ์การเข้าถึงไฟล์บน CDN (CDN Access Control Matrix)

| ประเภท / สถานะโมเดล | แสดงใน Gallery | สตรีมผ่าน `/preview.glb` หรือ `/:hash.glb` | สตรีมไฟล์เต็มผ่าน `/file.glb?key=` | ดาวน์โหลดไฟล์จริงผ่าน `/download` |
| :--- | :--- | :--- | :--- | :--- |
| **โมเดลฟรี (`price_cents = 0`)** | แสดงทุกคน | ทุกคน (ส่งไฟล์เต็ม) | ทุกคน (ไม่ต้องใช้ `key`) | ทุกคน (ไม่ต้องล็อกอิน) |
| **โมเดลเสียเงิน (`price_cents > 0`)** | แสดงทุกคน | ทุกคน (ส่งเฉพาะไฟล์ `preview` เท่านั้น บล็อก `file_hash` ด้วย `401 KEY_REQUIRED`) | เฉพาะผู้มี `embed_key` ที่ชำระเงินแล้ว (`status = 'paid'`) และตรงกับโมเดล | ต้องล็อกอิน (`Bearer JWT`) + ซื้อแล้ว (`status = 'paid'`) หรือเป็นเจ้าของโมเดล |
| **ถูกลบโดยเจ้าของ (`deleted_at`)** | ไม่แสดง (`404`) | ปิดกั้น (`404 MODEL_NOT_FOUND`) | **ผู้ซื้อเดิมยังสตรีมได้ปกติ** (Soft Delete) | **ผู้ซื้อเดิม/เจ้าของยังดาวน์โหลดได้** |
| **ถูกซ่อนโดยแอดมิน (`hidden_at`)** | ไม่แสดง | **ปิดกั้นทันที (`403 MODEL_UNAVAILABLE`)** | **ปิดกั้นทันที (`403`) แม้ซื้อแล้ว** | **ปิดกั้นทันที (`403`) แม้ซื้อแล้ว** |
| **เจ้าของถูกระงับ (`suspended_at`)** | ไม่แสดง | **ปิดกั้นทันที (`403 MODEL_UNAVAILABLE`)** | **ปิดกั้นทันที (`403`) แม้ซื้อแล้ว** | **ปิดกั้นทันที (`403`) แม้ซื้อแล้ว** |

---

## 4. ระบบฝังใบอนุญาตและลายน้ำ 2 ชั้นในไฟล์ `.glb` (Multi-Layer GLB Watermarking)

เพื่อปกป้องทรัพย์สินทางปัญญาของครีเอเตอร์และตรวจสอบแหล่งที่มาของไฟล์ `.glb` ที่ถูกดาวน์โหลดออกไป เซอร์วิส `cdn-service` (`src/utils/glbWatermark.ts`) ใช้ไลบรารี `@gltf-transform/core` ฝังลายน้ำดิจิทัล **2 ชั้น (Dual-Layer Protection)**:

1. **Layer 1 — Cryptographic Metadata Signature (`asset.extras` & `asset.copyright`):**
   - คำนวณรหัสลายเซ็น `signature` ด้วย `HMAC-SHA256` ร่วมกับ `WATERMARK_SECRET`
   - ฝังข้อมูล `{ platform: 'Lixyte', modelId, ownerId, license, purchaseId, signature, issuedAt }` ลงใน `asset.extras` และข้อความลิขสิทธิ์ใน `asset.copyright`
   - ตอนครีเอเตอร์อัปโหลดโมเดล ระบบจะฝัง `purchaseId: 'original'` เป็นลายน้ำต้นฉบับ และเมื่อผู้ซื้อกดดาวน์โหลด ระบบจะฝัง `purchaseId` และ `license_type` ของผู้ซื้อรายนั้นลงในไฟล์ `.glb` พร้อมบันทึกค่า `watermark_hash` ลงในตาราง `purchases`
2. **Layer 2 — 3D Vertex Steganography (`POSITION` Accessor):**
   - ดึงพิกัดจุดยอด (`POSITION` accessor) ของ Mesh แรกในไฟล์ `.glb` จำนวน 64 จุดแรก
   - นำบิต 64 บิตแรกของ `signature` ไปปรับค่าทศนิยมหลักที่ 4 ของพิกัดแกน X (`Math.round(x * 10000)`) ให้เป็นเลขคู่ (`0`) หรือเลขคี่ (`1`) โดยคำนวณแบบ `Float32`-safe
   - การขยับพิกัดเพียง `±0.0001` หน่วยไม่ส่งผลต่อรูปทรงเรขาคณิตเมื่อมองด้วยตาเปล่าใน Three.js หรือ `<model-viewer>` แต่ช่วยให้ระบบยังสามารถพิสูจน์ความเป็นเจ้าของโมเดลได้ผ่าน `POST /cdn/verify-watermark` แม้ว่าผู้ไม่หวังดีจะลบ `asset.extras` ออกจากการนำไฟล์ไป Export ใหม่ในโปรแกรม 3 มิติ

---

## 5. โครงสร้างโฟลเดอร์โปรเจกต์ (Project Structure)

```text
broken-design/
├── .agents/
│   └── rules/
│       └── mandatory-agent-spec.md       # กฎบังคับให้ AI Agent อ่าน AGENT.md ก่อนทำงานทุกครั้ง
├── .claude/
│   └── launch.json                       # การตั้งค่า Preview Server สำหรับ Claude Code
├── docs/                                 # เอกสาร Product, Architecture, Design System และ Task Board
│   ├── PRD.md                            # ขอบเขตผลิตภัณฑ์ (Product Requirements) และสถานะฟีเจอร์
│   ├── ARCHITECTURE.md                   # สถาปัตยกรรมระบบ, Data Flows และ Known Issues
│   ├── DESIGN_SYSTEM.md                  # กฎ UI, สี, ฟอนต์, ปุ่ม และ Components มาตรฐาน
│   └── TASKS.md                          # ตารางติดตามงาน (Task Board) แยกตามหน้าเว็บ/Backend/ผู้รับผิดชอบ
│
├── services/
│   ├── core-api/                         # [Microservice 1] Core Business Logic API (Port 4000)
│   │   ├── src/
│   │   │   ├── config/                   # db.ts, env.ts, cors.ts & cors.test.ts (4 test cases)
│   │   │   ├── middlewares/              # auth.middleware.ts (requireAuth/requireSeller/requireAdmin), error.middleware.ts  [แฮม]
│   │   │   ├── modules/
│   │   │   │   ├── admin/                # admin.routes.ts (8 endpoints) & admin.test.ts (20 test cases)  [เจี๊ยบ]
│   │   │   │   ├── auth/                 # auth.routes.ts (check-email, register, login) & auth.test.ts (2 test cases)  [ต้า]
│   │   │   │   ├── complaints/           # complaints.routes.ts (POST /api/complaints) & complaints.test.ts (5 test cases)  [เจี๊ยบ]
│   │   │   │   ├── interactions/         # interactions.routes.ts (Likes/Comments — stub)
│   │   │   │   ├── models/               # models.routes.ts (รายการ, ค้นหา/กรอง, รายละเอียด, Soft Delete)  [เป้ก / แฮม]
│   │   │   │   ├── payments/             # payments.routes.ts & payments.test.ts (12 test cases)  [ภีม]
│   │   │   │   └── seller/               # seller.routes.ts & seller.test.ts (5 test cases)  [ภีม]
│   │   │   ├── scripts/
│   │   │   │   └── seedAdmin.ts          # สคริปต์สร้างบัญชี Admin และ Creator เริ่มต้น  [แฮม]
│   │   │   └── app.ts                    # Entry point ของ Core API (/health, /api/*)
│   │   ├── .dockerignore
│   │   ├── .env.example
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── cdn-service/                      # [Microservice 2] High-I/O Upload, Watermark & 3D Streaming CDN (Port 4001)
│       ├── src/
│       │   ├── config/                   # db.ts (PostgreSQL Pool + Supabase REST Fallback), env.ts, supabase.ts
│       │   ├── middlewares/              # auth.middleware.ts & error.middleware.ts  [แฮม]
│       │   ├── storage/                  # index.ts, storage.interface.ts, local.storage.ts, supabase.storage.ts  [แฮม / นนท์]
│       │   ├── utils/
│       │   │   ├── glbValidator.ts       # ตรวจ Magic Bytes ของไฟล์ .glb (glTF v2) และการคำนวณ SHA-256  [แฮม]
│       │   │   └── glbWatermark.ts       # ฝังและตรวจลายน้ำ 2 ชั้น (Metadata HMAC + Vertex Steganography)  [นนท์]
│       │   ├── modules/
│       │   │   ├── upload/               # upload.routes.ts (รับไฟล์ .glb/.webp, ฝังลายน้ำต้นฉบับ, ลง Storage + DB)  [แฮม]
│       │   │   └── cdn/                  # สตรีมไฟล์ .glb/.webp, ตรวจ embed_key, ฝังลายน้ำผู้ซื้อ, Range, Cache  [นนท์]
│       │   │       ├── cdn.routes.ts     #   Routes ของ /cdn/models/* และ POST /cdn/verify-watermark
│       │   │       ├── cdn.service.ts    #   ตรวจสิทธิ์, constant-time embed_key, บันทึก watermark_hash และส่งสตรีม
│       │   │       ├── range.ts          #   ตัวแปลง HTTP Range Header (RFC 9110 §14)
│       │   │       ├── cdn.test-env.ts   #   ตั้งค่า Environment สำหรับรันเทสต์ CDN ในโหมด local
│       │   │       └── cdn.test.ts       #   ชุดทดสอบ CDN & Watermark (23 test cases)
│       │   └── app.ts                    # Entry point ของ CDN Service (/health, /api/models, /cdn/*, /verify-watermark)
│       ├── storage_data/.gitkeep         # ไดเรกทอรีสำรองเมื่อใช้ STORAGE_PROVIDER=local
│       ├── tmp_uploads/.gitkeep          # พื้นที่พักไฟล์ชั่วคราวระหว่างรับ Multipart upload
│       ├── .dockerignore
│       ├── .env.example
│       ├── Dockerfile
│       ├── package.json
│       └── tsconfig.json
│
├── frontend/                             # Next.js 15 Frontend & WebGL Viewer (Port 3000)
│   ├── public/
│   │   └── embed.js                      # Web Component <vm-model> พร้อมระบบสลับไป preview เมื่อ key ผิด  [เจี๊ยบ / นนท์]
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx                  # หน้าแรก Landing & Featured 3D Models
│   │   │   ├── layout.tsx                # Root Layout (Fonts, Navbar, Footer, ReportProvider)
│   │   │   ├── globals.css               # Tailwind & Theme styles
│   │   │   ├── 403/page.tsx              # หน้า 403 Access Denied  [เป้ก]
│   │   │   ├── not-found.tsx             # หน้า 404 Not Found ทั่วทั้งเว็บ  [เป้ก]
│   │   │   ├── error.tsx                 # หน้า 500 Global Error Boundary  [เป้ก]
│   │   │   ├── gallery/                  # page.tsx (ค้นหา/กรอง/แบ่งหน้า) & error.tsx  [เป้ก]
│   │   │   ├── creator/page.tsx          # หน้า Creator Landing พร้อมผีเสื้อ 3 มิติ  [เจี๊ยบ]
│   │   │   ├── creators/[handle]/        # page.tsx & not-found.tsx (หน้าโปรไฟล์ครีเอเตอร์)  [เจี๊ยบ]
│   │   │   ├── models/[id]/              # page.tsx & not-found.tsx (รายละเอียดโมเดล + 3D Preview + Embed + ซื้อ/ดาวน์โหลด)  [นนท์]
│   │   │   ├── embed/[id]/page.tsx       # หน้า Viewer สำหรับ Iframe (CSP frame-ancestors *)  [นนท์]
│   │   │   ├── login/page.tsx            # หน้าเข้าสู่ระบบและสมัครสมาชิก  [ต้า]
│   │   │   ├── forgot-password/page.tsx  # หน้ารีเซ็ตรหัสผ่าน (UI อย่างเดียว ยังไม่มี endpoint)  [ต้า]
│   │   │   ├── upload/page.tsx           # หน้าอัปโหลด .glb + สร้างภาพ Poster ด้วย .toBlob()  [แฮม]
│   │   │   ├── me/page.tsx               # หน้า Dashboard ผู้ซื้อ (Placeholder — รอพัฒนาต่อใน Phase 2)  [ภีม]
│   │   │   └── admin/                    # layout.tsx & 5 หน้าแดชบอร์ดแอดมิน (Overview, Models, Users, Purchases, Complaints)  [เจี๊ยบ]
│   │   ├── components/
│   │   │   ├── Navbar.tsx, Footer.tsx, AccountMenu.tsx, AdminOnlyRedirect.tsx, PixieCursor.tsx
│   │   │   ├── admin/                    # AdminList.tsx, AdminShell.tsx, ComplaintCells.tsx, ui.tsx  [เจี๊ยบ]
│   │   │   ├── auth/                     # AuthForm.tsx, Field.tsx, ForgotPasswordForm.tsx  [ต้า]
│   │   │   ├── creator/                  # CreatorModel.tsx
│   │   │   ├── gallery/                  # FilterBar.tsx, FilterDropdown.tsx, ModelCard.tsx, Pagination.tsx
│   │   │   ├── landing/                  # Categories.tsx, PopularCarousel.tsx, SectionHeading.tsx
│   │   │   ├── model/                    # EmbedSnippets.tsx, LicenseRules.tsx, ModelActions.tsx, ModelPreview.tsx
│   │   │   ├── profile/                  # DonateCard.tsx, ProfileHeader.tsx
│   │   │   ├── report/                   # ReportForm.tsx, ReportProvider.tsx  [เจี๊ยบ]
│   │   │   ├── ui/                       # Modal.tsx  [เจี๊ยบ]
│   │   │   └── viewer/                   # ButterflyScene.tsx, CreatorScene.tsx, CreatorViewer.tsx, EmbedIframeViewer.tsx, LilyScene.tsx, LilyViewer.tsx
│   │   ├── lib/
│   │   │   ├── api.ts, auth.ts, auth-paths.ts, session.ts
│   │   │   ├── admin-api.ts, complaints.ts
│   │   │   ├── creators.ts, format.ts, licenses.ts, types.ts
│   │   │   └── pagination.ts & pagination.test.mjs (4 test cases)
│   │   └── types/model-viewer.d.ts
│   ├── next.config.ts, tailwind.config.ts, postcss.config.mjs, tsconfig.json
│   ├── .dockerignore, .env.example, Dockerfile, package.json
│
├── supabase/
│   └── schema.sql                        # สคริปต์สร้างตาราง users, models, purchases, likes, comments, complaints + Seed
├── .gitignore
├── docker-compose.yml                    # รันทุก Microservices พร้อมกันด้วยคำสั่งเดียว
├── AGENT.md                              # คู่มือสถาปัตยกรรม, Security Rules, API Contract และ Roadmap สำหรับ AI Agent
├── AGENTS.md                             # ตัวชี้กฎ (Pointer) สำหรับ OpenAI Codex / Cursor / Windsurf / Copilot Agents
├── CLAUDE.md                             # ตัวชี้กฎ + แนวทางทำงานเฉพาะสำหรับ Claude Code Agent
├── GEMINI.md                             # ตัวชี้กฎ (Pointer) สำหรับ Google Antigravity / Gemini Agent
└── README.md                             # เอกสารคู่มือหลักของโปรเจกต์
```

### 5.1 สรุปหน้าที่ของไฟล์เอกสาร (`.md`) ในโปรเจกต์ (Single Source of Truth)

เพื่อลดการเขียนข้อมูลซ้ำซ้อนกัน เอกสารแต่ละไฟล์มีขอบเขตหน้าที่รับผิดชอบแยกกันดังนี้:

| ไฟล์ | กลุ่มเป้าหมาย | ขอบเขตหน้าที่ (Single Source of Truth) |
| :--- | :--- | :--- |
| [`README.md`](./README.md) | ทีมพัฒนา & บุคคลทั่วไป | ภาพรวมโปรเจกต์, โครงสร้างไฟล์, API Reference ฉบับย่อ, การแบ่งงานทีม 6 คน และคู่มือติดตั้ง/รัน Docker & Tests |
| [`AGENT.md`](./AGENT.md) | AI Agent ทุกตัว | **ศูนย์กลางกฎวิศวกรรม:** Access Control Matrix, Security Invariants, สเปก API/DB/Watermark, Roadmap (§6) และ Verification Checklist (§7) |
| [`AGENTS.md`](./AGENTS.md) | Codex / Cursor / Windsurf / Copilot | ตัวชี้กฎ (Pointer) ให้ปฏิบัติตาม `AGENT.md` และ `README.md` |
| [`GEMINI.md`](./GEMINI.md) | Google Antigravity / Gemini | ตัวชี้กฎ (Pointer) ไปยัง `AGENT.md`, `DESIGN_SYSTEM.md`, `TASKS.md` และ `ARCHITECTURE.md` |
| [`CLAUDE.md`](./CLAUDE.md) | Claude Code | ตัวชี้กฎไปยังเอกสารหลัก + กฎเฉพาะของการสื่อสาร/Three.js/`.claude/launch.json` โดยไม่คัดลอกซ้ำ |
| [`.agents/rules/mandatory-agent-spec.md`](./.agents/rules/mandatory-agent-spec.md) | Workspace Rule (Agent) | กฎโหลดอัตโนมัติระดับ Workspace ชี้ไปยังหัวข้อสำคัญใน `AGENT.md` และ `docs/*` |
| [`docs/PRD.md`](./docs/PRD.md) | Product / ทีม | เป้าหมายผลิตภัณฑ์, กลุ่มผู้ใช้, ขอบเขตฟีเจอร์ MVP vs Later, Content Rules และ Open Questions *(ไม่เก็บสถานะราย route)* |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Dev / Architecture | ผัง Component ระดับไฟล์, End-to-End Flows, การ Deploy และรายการ **Known Issues (§5)** ก่อนเปิดใช้งานจริง |
| [`docs/DESIGN_SYSTEM.md`](./docs/DESIGN_SYSTEM.md) | Frontend / UI | โทเคนสี, ฟอนต์, Spacing, ปุ่ม, การ์ด, ไอคอน (`lucide-react`), รูปแบบหน้าและกฎ Accessibility |
| [`docs/TASKS.md`](./docs/TASKS.md) | ทีมทุกคน | **Task Board หลัก:** ติดตามสถานะรายหน้า/ราย endpoint (`[x]` / `[~]` / `[ ]`) และผู้รับผิดชอบ |

---

## 6. รายละเอียด API Endpoints & การฝังโมเดล (API & Embed Reference)

### 6.1 CDN Service (`http://localhost:4001`)

| Method & Path | การยืนยันตัวตน | Cache-Control | รายละเอียดการทำงาน |
| :--- | :--- | :--- | :--- |
| `POST /api/models` | `Bearer JWT` (Seller) | `no-store` | อัปโหลดไฟล์ `file` (`.glb` ≤ 50 MB), `preview` (`.glb` ≤ 5 MB, บังคับถ้ามีราคา), `poster` (`.webp/.png/.jpg` ≤ 1 MB) พร้อมฝังลายน้ำต้นฉบับ (`purchaseId: 'original'`) |
| `GET /cdn/models/:id/:hash.glb` | Public | `public, max-age=31536000, immutable` | สตรีมไฟล์ตามค่า SHA-256 (เฉพาะไฟล์ของโมเดลฟรี หรือไฟล์ `preview` ของโมเดลเสียเงิน) รองรับ HTTP Range (`206`/`416`) |
| `GET /cdn/models/:id/preview.glb` | Public | `public, max-age=300` | สตรีมไฟล์ตัวอย่างสำหรับแสดงผลสาธารณะ (โมเดลฟรีส่งไฟล์เต็ม โมเดลเสียเงินส่งไฟล์ preview) |
| `GET /cdn/models/:id/file.glb?key=` | `embed_key` (สำหรับโมเดลเสียเงิน) | `private, no-store` | ตรวจ `embed_key` ด้วย `crypto.timingSafeEqual` กับตาราง `purchases (status='paid')` ก่อนสตรีมไฟล์เต็ม |
| `GET /cdn/models/:id/download` | `Bearer JWT` (สำหรับโมเดลเสียเงิน) | `private, no-store` | ดาวน์โหลดไฟล์ `.glb` (สำหรับผู้ซื้อจะฝัง `purchaseId` + `license_type` ลงในไฟล์และบันทึก `watermark_hash` ลงตาราง `purchases`) พร้อมนับ `download_count + 1` |
| `GET /cdn/models/:id/poster.webp` | Public | `public, max-age=300` | สตรีมภาพหน้าปกของโมเดล (`image/webp`) |
| `POST /cdn/verify-watermark` | Public | `no-store` | รับไฟล์ `.glb` ต้องสงสัย (`multipart/form-data` หรือ `model/gltf-binary`) เพื่อตรวจสอบลายน้ำทั้งจาก `asset.extras` และพิกัด `POSITION` 64 จุดแรก |

### 6.2 Core API (`http://localhost:4000`)

| หมวดหมู่ | Method & Path | รายละเอียดการทำงาน |
| :--- | :--- | :--- |
| **Auth** | `POST /api/auth/check-email` | ตรวจสอบว่าอีเมลมีบัญชีอยู่ในระบบแล้วหรือไม่ (`{ exists }`) |
| **Auth** | `POST /api/auth/register` | สมัครสมาชิกใหม่ (เข้ารหัสรหัสผ่านด้วย `bcrypt` และคืนค่า JWT) |
| **Auth** | `POST /api/auth/login` | เข้าสู่ระบบ (ตรวจสอบรหัสผ่าน และบล็อกบัญชีที่มี `suspended_at` ด้วย `403 ACCOUNT_SUSPENDED`) |
| **Models** | `GET /api/models` | ดึงรายการโมเดล ค้นหา (`q`), กรองตาม `tag`, `license`, `price=free\|paid` และแบ่งหน้า (`page`) |
| **Models** | `GET /api/models/:id` | ดึงข้อมูลรายละเอียดโมเดล (ซ่อนลิงก์ไฟล์จริงหากเป็นโมเดลเสียเงิน) |
| **Models** | `DELETE /api/models/:id` | ลบโมเดลแบบ Soft Delete (`deleted_at = NOW()`) เฉพาะเจ้าของหรือแอดมิน |
| **Payments** | `POST /api/models/:id/checkout` | สร้างคำสั่งซื้อรายชิ้น (`pending`) ล็อก `amount_cents`, `currency`, `license_type` และสุ่ม `embed_key` 48 ตัวอักษร hex |
| **Payments** | `POST /api/purchases/:id/confirm-mock` | ยืนยันการชำระเงินจำลอง (`status = 'paid'`, `paid_at = NOW()`) เฉพาะเมื่อ `PAYMENT_PROVIDER=mock` |
| **Payments** | `GET /api/me/purchases` | ดึงรายการโมเดลที่ซื้อสำเร็จพร้อม `embed_key`, ราคาที่ซื้อ, ประเภท License และ `watermark_hash` |
| **Payments** | `POST /api/purchases/:id/regenerate-key` | สุ่ม `embed_key` ใหม่และยกเลิกสิทธิ์ของคีย์เก่าทันที |
| **Seller** | `POST /api/seller/enable` | เปิดโหมดคนขาย (`is_seller = true`) ให้บัญชีปัจจุบัน |
| **Seller** | `GET /api/seller/models` & `/sales` | ดูรายการโมเดลของตัวเองและสรุปยอดขายทั้งหมด |
| **Admin** | `GET /api/admin/overview` | ดูสรุปยอดรวมระบบ, สถิติ 7 วัน, Top 5 โมเดล, รายการซื้อ/ผู้ใช้ล่าสุด และคำร้องเรียนที่เปิดอยู่ (ตรวจ `role = 'admin'` จาก DB) |
| **Admin** | `GET /api/admin/users` & `PATCH .../suspend` | ดูรายชื่อผู้ใช้ และระงับ/คืนสิทธิ์บัญชี พร้อมเหตุผลและเวลาสิ้นสุด (ไม่ส่งเวลา = จนกว่าแอดมินจะปลด) ผู้ใช้ได้รับใบเตือนทุกครั้ง (ห้ามแอดมินระงับตัวเอง) |
| **Admin** | `GET /api/admin/models`, `PATCH .../hide` & `PATCH .../license` | ดูรายการโมเดลทั้งหมด (รวมซ่อน/ลบ) ซ่อน/แสดงผลโมเดล และแก้ license พร้อมเหตุผล (เจ้าของได้รับใบเตือน) |
| **Admin** | `GET /api/admin/purchases` & `GET .../purchases/:id` | ดูรายการสั่งซื้อทั้งหมด (กรองสถานะ/ช่วงวันที่) และรายละเอียดรายการเดียว พร้อมข้อมูลผู้ซื้อ โมเดล ราคา และ `watermark_hash` |
| **Admin** | `GET /api/admin/complaints` & `PATCH .../:id` | ดูรายการคำร้องเรียนจากผู้ใช้ เปลี่ยนสถานะ (`open`/`in_review`/`resolved`/`dismissed`) และบันทึกโน้ต |
| **Complaints** | `POST /api/complaints` | ผู้ใช้ที่ล็อกอินส่งคำร้องเรียน/แจ้งปัญหา (`model`/`account`/`purchase`/`other`, จำกัด 5 ครั้ง/ชั่วโมง) |

### 6.3 การฝังโมเดลข้ามโดเมน (Cross-Origin Embed Contract)

นักพัฒนาสามารถฝังโมเดล 3 มิติลงในเว็บไซต์ภายนอกได้ 2 รูปแบบ:

1. **Web Component (`<vm-model>`)**:
   ```html
   <script type="module" src="http://localhost:3000/embed.js"></script>
   <vm-model
     model-id="7524b129-938b-41c9-b66c-977a809e1c89"
     cdn-base="http://localhost:4001"
     key="YOUR_EMBED_KEY"
     auto-rotate
     camera-controls
   ></vm-model>
   ```
   *(สำหรับโมเดลฟรีไม่ต้องใส่ attribute `key` หากใส่ `key` ของโมเดลเสียเงินผิดหรือคีย์ถูก Regenerate ไปแล้ว ตัว Viewer จะสลับไปโหลดไฟล์ `preview.glb` พร้อมแสดงข้อความแจ้งเตือน `"ต้องซื้อเพื่อใช้งาน"` อัตโนมัติโดยไม่ทำให้หน้าเว็บพัง)*

2. **Iframe (`/embed/[id]`)**:
   ```html
   <iframe
     src="http://localhost:3000/embed/7524b129-938b-41c9-b66c-977a809e1c89?key=YOUR_EMBED_KEY"
     width="600"
     height="400"
     loading="lazy"
     allow="fullscreen"
     style="border:0"
   ></iframe>
   ```

---

## 7. การแบ่งงานภายในทีมผู้พัฒนา 6 คน (Team Responsibilities)

| สมาชิก | บทบาทและความรับผิดชอบหลัก | พื้นที่รับผิดชอบในโค้ดเบส |
| :--- | :--- | :--- |
| **เจี๊ยบ** (คู่ภีม) | Frontend ส่วนกลางและหน้าเนื้อหา: Navbar/Footer (เมนูเปลี่ยนตามสถานะ login), หน้าแรก (Landing), หน้า Creator Landing และโปรไฟล์ Creator, `/docs`, `/licenses`, หน้ากฎหมาย และ **โมดูล Admin ทั้งหมด** (Backend `/api/admin/*` และหน้า `/admin/*` 4 หน้า) | `frontend/src/components/` (Navbar, Footer)<br>`frontend/src/app/` (หน้าเนื้อหา, `admin/`)<br>`services/core-api/src/modules/admin/` |
| **ภีม** (คู่เจี๊ยบ) | ระบบซื้อขายรายชิ้นจำลอง (`checkout`, ยืนยันจ่าย, สร้าง/Regenerate `embed_key`, รายการที่ซื้อ), หน้าจ่ายเงินจำลอง, และแดชบอร์ดคนขาย (โมเดลของฉัน ยอดขาย ปุ่มเปิดโหมดคนขาย) พร้อมหน้าเว็บของระบบเหล่านี้: `/checkout`, `/pay/mock`, หน้ายืนยันคำสั่งซื้อ, `/me` (รายการที่ซื้อ, embed key, Regenerate) และ `/seller` | `services/core-api/src/modules/payments/`, `seller/`<br>`frontend/src/app/pay/`, `checkout/`, `me/`, `seller/` (ยกเว้น `seller/models/` ของแฮม) |
| **นนท์** (คู่เป้ก) | ระบบ CDN & Watermark: สตรีมไฟล์โมเดล/ภาพปก, ตรวจ `embed_key` แบบ Constant-Time, ฝังและตรวจลายน้ำ 2 ชั้นในไฟล์ `.glb`, HTTP Range, Cache, Rate limit, เชื่อมต่อ CDN เข้ากับ Supabase & Frontend พร้อมหน้าเว็บ: ส่วน viewer/ดาวน์โหลดของ `/models/[id]`, `/embed/[id]`, Embed Playground, `/verify` (ตรวจลายน้ำ) และสถานะเมื่อ WebGL ใช้ไม่ได้ | `services/cdn-service/src/modules/cdn/`, `utils/glbWatermark.ts`<br>`frontend/src/app/embed/`, `verify/`, `components/model/`, `components/playground/` |
| **แฮม** (คู่ต้า) | โครงสร้างฐานข้อมูล `schema.sql`, Middlewares ตรวจสิทธิ์และรูปแบบ Error, `StorageAdapter` (`LocalDiskStorage` / `SupabaseStorage`), ตรวจ Magic Bytes ของ `.glb`, รับอัปโหลดโมเดล + สร้าง Poster, ลบโมเดล (Soft Delete), `PATCH /api/models/:id` (แก้ข้อมูลโมเดล) และให้ `requireAdmin` ตรวจสิทธิ์จากฐานข้อมูล พร้อมหน้าเว็บ `/upload` และ `/seller/models/[id]` (แก้/ลบโมเดล) | `supabase/`<br>`services/core-api/src/middlewares/`<br>`services/cdn-service/src/storage/`, `utils/glbValidator.ts`, `modules/upload/`<br>`frontend/src/app/upload/`, `seller/models/` |
| **ต้า** (คู่แฮม) | ระบบสมาชิก (`register` / `login` ด้วย `bcrypt` + JWT, บล็อกบัญชีที่ถูกระงับ), endpoint ลืมรหัสผ่าน และฝั่งหน้าเว็บของระบบสมาชิก: `/login`, `/forgot-password`, การเก็บ token และตัวส่ง request กลาง (`apiFetch`) ที่ทุกหน้าใช้ร่วมกัน | `services/core-api/src/modules/auth/`<br>`frontend/src/app/login/`, `forgot-password/`, `components/auth/`, `lib/` (ตัวส่ง request กลาง) |
| **เป้ก** (คู่นนท์) | ระบบแคตตาล็อกโมเดล: ดึงรายการ/ค้นหา/กรอง/แบ่งหน้า/รายละเอียดโมเดล (กรองโมเดลที่ซ่อนหรือลบ และไม่ส่งลิงก์ไฟล์เต็มของโมเดลเสียเงิน) พร้อมหน้าเว็บ `/gallery` ที่ต่อ API จริง (ค้นหา/กรอง/แบ่งหน้า), `/search` และหน้าระบบของทั้งเว็บ (404, 403, 500) | `services/core-api/src/modules/models/`<br>`frontend/src/app/gallery/`, `not-found.tsx`, `error.tsx`, `403/` |

ทุกคนทำ Frontend ของระบบที่ตัวเองดูแลเอง รายการหน้าทั้งหมด สถานะ และผู้รับของแต่ละหน้าอยู่ใน [`docs/TASKS.md`](./docs/TASKS.md)

---

## 8. วิธีติดตั้งและเริ่มต้นใช้งาน (Getting Started & Testing)

### 8.1 ขั้นตอนการติดตั้ง
1. **Clone โปรเจกต์และติดตั้ง Dependencies:**
   ```bash
   git clone https://github.com/TuraHot/broken-design.git
   cd broken-design

   cd services/core-api && npm install
   cd ../cdn-service && npm install
   cd ../../frontend && npm install
   ```
2. **ตั้งค่าฐานข้อมูลและ Storage บน Supabase:**
   - นำสคริปต์ใน [`supabase/schema.sql`](./supabase/schema.sql) ไปรันใน **SQL Editor** ของ Supabase เพื่อสร้างตารางและบัญชีตัวอย่าง
   - สร้าง Storage Bucket ชื่อ `models` บน Supabase Storage สำหรับจัดเก็บไฟล์ `.glb` และ `.webp`
3. **ตั้งค่าไฟล์ Environment (`.env` / `.env.local`):**
   - คัดลอก `.env.example` เป็น `.env` ใน `services/core-api/` และ `services/cdn-service/` และเป็น `.env.local` ใน `frontend/` (`docker-compose.yml` จะโหลด `.env` / `.env.local` ทับ `.env.example` ให้อัตโนมัติ พร้อมส่ง `INTERNAL_CORE_API_URL=http://core-api:4000` ให้ Container `frontend`)
   - กำหนดค่า `DATABASE_URL`, `JWT_SECRET` (ให้ตรงกันทั้ง `core-api` และ `cdn-service`), `WATERMARK_SECRET`, และ `SUPABASE_URL` / `SUPABASE_KEY` (สำหรับ Storage bucket `models` ใน `cdn-service`) — *ห้ามนำไฟล์ `.env` ขึ้น Git*
   - หากใช้ `docker compose` แนะนำให้ตั้งค่า `DATABASE_URL` เป็น **Supabase IPv4 Session Pooler** (`aws-0-<region>.pooler.supabase.com:5432`) เนื่องจาก Direct Host (`db.<project>.supabase.co`) เป็น IPv6-only ซึ่งเครือข่าย Docker Bridge เริ่มต้นไม่รองรับ

### 8.2 บัญชีทดสอบเริ่มต้น (Default Seed Accounts)
- **Admin:** `admin@brokendesign.com` / รหัสผ่าน: `Admin@BrokenDesign2026!`
- **Creator (คนขาย):** `creator@brokendesign.com` / รหัสผ่าน: `Creator@BrokenDesign2026!`
- **โมเดล 3D ตัวอย่างบน Supabase:** ID `7524b129-938b-41c9-b66c-977a809e1c89` (`Lixyte Crystal Cube`)
- **Buyer:** `buyer@lixyte.com` / รหัสผ่าน: `Buyer@BrokenDesign2026!`

### 8.3 การรันระบบและการทดสอบ (Running & Testing)
- **รันทุกเซอร์วิสพร้อมกันด้วย Docker Compose:**
  ```bash
  docker compose up -d --build
  ```
- **หรือรันแยกแต่ละเซอร์วิสในโหมดพัฒนา (`npm run dev`):**
  - `frontend`: `http://localhost:3000`
  - `services/core-api`: `http://localhost:4000`
  - `services/cdn-service`: `http://localhost:4001`
- **รันชุดทดสอบอัตโนมัติ (Unit & Integration Tests):**
  ```bash
  # 1. ทดสอบ CDN Service & Multi-Layer GLB Watermarking (23 test cases)
  cd services/cdn-service
  npx tsc --noEmit -p .
  npm test

  # 2. ทดสอบ Core API — Auth, Payments, Seller, Admin, Complaints & CORS (48 test cases)
  cd services/core-api
  npx tsc --noEmit -p .
  npm test

  # 3. ตรวจสอบ Type-Check และ Unit Tests ของฝั่ง Frontend (4 test cases)
  cd frontend
  npx tsc --noEmit -p .
  npm test
  ```
