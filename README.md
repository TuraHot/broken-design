# Broken Design — 3D Asset Repository & WebGL CDN Platform

**Broken Design** คือแพลตฟอร์ม **"Google Fonts สำหรับโลก 3 มิติ"** ศูนย์กลางในการจัดเก็บ ค้นหา และสตรีมไฟล์โมเดล 3 มิติมาตรฐาน `.glb` (Binary glTF) สำหรับนักพัฒนาเว็บและครีเอเตอร์ รองรับการฝังโมเดลลงบนเว็บไซต์ภายนอก (Embed) ผ่าน `<iframe>` และ Web Component `<vm-model>` แบบข้ามโดเมน (Cross-Origin CDN) โดยไม่ต้องดาวน์โหลดหรือโฮสต์ไฟล์เอง

---

## 1. สถาปัตยกรรมระบบแบบ Microservices (System Architecture)

โปรเจกต์ **Broken Design** แยกส่วน Backend ออกเป็น **2 Microservices** ตามลักษณะการใช้ทรัพยากร เพื่อป้องกันไม่ให้การอัปโหลดและสตรีมไฟล์ 3 มิติขนาดใหญ่กระทบต่อความเร็วของระบบ API หลัก:

| เซอร์วิส / โฟลเดอร์ | พอร์ต | เทคโนโลยีหลัก | หน้าที่รับผิดชอบ |
| :--- | :---: | :--- | :--- |
| **`frontend/`** | `3000` | Next.js (App Router), Tailwind CSS, `@google/model-viewer` | หน้าเว็บ Gallery, Embed Playground, หน้า `/embed/[id]` สำหรับ Iframe, สคริปต์ `public/embed.js` (`<vm-model>`), แดชบอร์ดคนขาย และแดชบอร์ดแอดมิน |
| **`services/core-api/`** | `4000` | Express 5, TypeScript, JWT, bcrypt | จัดการระบบสมาชิก (`auth`), ข้อมูลแคตตาล็อกและการค้นหา (`models`), ระบบซื้อขายแบบจำลองและสร้างคีย์ (`payments`), ส่วนคนขาย (`seller`) และส่วนแอดมิน (`admin`) |
| **`services/cdn-service/`** | `4001` | Express 5, TypeScript, Multer, Node Streams | รับอัปโหลดไฟล์ `.glb` (สูงสุด 50 MB), ตรวจ Magic Bytes (`glTF` v2), เก็บไฟล์ด้วย `sha256` ลง `LocalDiskStorage` และสตรีมไฟล์ผ่าน `/cdn/*` (รองรับ CORS, Cache, HTTP Range) |
| **`supabase/`** | `5432` | Supabase PostgreSQL | ฐานข้อมูลกลางสำหรับเก็บตาราง `users`, `models` (`tags text[]`), `purchases`, `likes`, และ `comments` |

---

## 2. บทบาทผู้ใช้ (Roles)

ลูกค้าและคนขายเป็น **บัญชีเดียวกัน** ส่วนแอดมินมีไว้ดูแลเว็บเท่านั้น

| บทบาท | วิธีได้สิทธิ์ | เห็นและทำอะไรได้ |
| :--- | :--- | :--- |
| **ลูกค้า** | สมัครสมาชิก | ดู Gallery, ซื้อโมเดล, ดาวน์โหลด, ขอโค้ดฝัง, หน้า `/me` (โมเดลที่ซื้อ + `embed_key`) |
| **คนขาย** (Creator) | กดเปิด "โหมดคนขาย" ในบัญชีเดิม | ทุกอย่างของลูกค้า + แดชบอร์ดคนขาย (`/seller`: โมเดลของฉัน ยอดขาย) + อัปโหลด/ลบโมเดลของตัวเอง |
| **แอดมิน** | ตั้งในฐานข้อมูลเท่านั้น สมัครเองไม่ได้ | แดชบอร์ดแอดมิน (`/admin/*`): ภาพรวม, ซ่อน/คืนโมเดล, ระงับ/คืนบัญชี, ดูรายการซื้อขายทั้งระบบ ซื้อและขายเองไม่ได้ |

หลักการ: การตรวจสิทธิ์ทำที่ **Backend เสมอ** (ไม่ใช่แค่ซ่อนปุ่มบนหน้าเว็บ) โมเดลที่ถูกซ่อนหรือเจ้าของถูกระงับต้องหยุดถูกส่งไฟล์ผ่าน CDN ทันที

---

## 3. เทคโนโลยีที่ใช้พัฒนา (Tech Stack)

- **Frontend & 3D WebGL (`frontend/`)**
  - **Framework & Styling**: Next.js 15 (App Router), React 19, TypeScript 5, Tailwind CSS 3, Lucide React
  - **3D Rendering & Embed**: `@google/model-viewer` v4, Three.js, Web Components (`<vm-model>`), มาตรฐานไฟล์ Binary glTF 2.0 (`.glb`)
- **Backend — Core API (`services/core-api/`)**
  - **Runtime & Framework**: Node.js 22, Express 5, TypeScript 5 (`tsx`)
  - **Auth, Validation & Security**: JSON Web Token (`jsonwebtoken`), `bcrypt`, `zod`, `express-rate-limit`, `cors`
  - **Payments**: เวอร์ชันแรกใช้ **Mock Checkout (จ่ายเงินจำลอง)** ผ่านตัวแปร `PAYMENT_PROVIDER=mock` ส่วน Stripe SDK (`stripe`) ติดตั้งไว้สำหรับเฟสถัดไป (ยังไม่เปิดใช้)
- **Backend — Asset CDN & Storage (`services/cdn-service/`)**
  - **Upload & File Streaming**: `multer`, Node.js Streams (`fs` / `stream`), HTTP Range Requests, Cross-Origin Resource Sharing (CORS) & Cache-Control
  - **Storage & Asset Integrity**: Content-Addressable Storage (`sha256` ผ่าน `StorageAdapter` — รองรับทั้ง `LocalDiskStorage` และ Supabase Storage), GLB Magic Bytes Validator, Constant-Time Key Check (`crypto.timingSafeEqual`)
- **Database & Cloud Storage (`supabase/`)**
  - **Database & Driver**: Supabase (PostgreSQL), `pg` (`node-postgres`), `pgcrypto` (`UUID`), GIN Index สำหรับค้นหา `tags` (`TEXT[]`)
  - **Object Storage**: Supabase Storage (เก็บไฟล์ `.glb` และ `poster.webp` แบบถาวรเมื่อ Deploy บน Cloud Free Tier)
- **DevOps, Cloud Hosting & Deployment**
  - **Frontend Hosting**: **Vercel** (Next.js App Router & Global Edge CDN สำหรับ `embed.js`)
  - **Backend Hosting**: **Render** (Web Services สำหรับรัน `core-api` และ `cdn-service`)
  - **Database & Storage Hosting**: **Supabase** (Managed PostgreSQL & Supabase Storage)
  - **Local Containerization**: Docker (`node:22-alpine`), Docker Compose (Multi-container & Docker Volumes)

---

## 4. โครงสร้างโฟลเดอร์โปรเจกต์ (Project Structure)

รายการที่ติดป้าย **(ใหม่)** คือโฟลเดอร์หรือไฟล์ที่ยังไม่มีในโครง ต้องสร้างเพิ่ม

```text
broken-design/
├── services/
│   ├── core-api/                         # [Microservice 1] Core Business Logic API (Port 4000)
│   │   ├── src/
│   │   │   ├── config/                   # ตั้งค่าการเชื่อมต่อ Supabase DB และ Environment Variables
│   │   │   ├── middlewares/              # JWT Auth, ตรวจบทบาท (requireSeller / requireAdmin), Error Handler  [แฮม]
│   │   │   ├── modules/
│   │   │   │   ├── auth/                 # สมัครสมาชิก, ล็อกอิน (bcrypt + JWT), เปิดโหมดคนขาย  [ต้า]
│   │   │   │   ├── models/               # ดึงรายการ, ค้นหา, กรอง, แบ่งหน้า, รายละเอียดโมเดล  [เป้ก]
│   │   │   │   ├── payments/             # Checkout จำลอง, สร้าง/Regenerate embed_key, รายการที่ซื้อ  [ภีม]
│   │   │   │   ├── seller/               # (ใหม่) ยอดขายและโมเดลของคนขาย  [ภีม]
│   │   │   │   ├── admin/                # (ใหม่) ภาพรวม, ซ่อน/คืนโมเดล, ระงับ/คืนบัญชี, รายการซื้อขาย  [ต้า: ผู้ใช้ / เป้ก: โมเดลและรายการซื้อ]
│   │   │   │   └── interactions/         # ถูกใจและความคิดเห็น (Likes/Comments) — เฟสถัดไป ยังไม่มีผู้รับผิดชอบ
│   │   │   └── app.ts                    # Entry point ของ Core API (/api/*)
│   │   ├── .env.example
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   └── cdn-service/                      # [Microservice 2] High-I/O Upload & 3D Streaming CDN (Port 4001)
│       ├── src/
│       │   ├── config/                   # ตั้งค่าขนาดไฟล์สูงสุดและโฟลเดอร์ Storage
│       │   ├── storage/                  # StorageAdapter Interface & LocalDiskStorage (sha256)  [แฮม]
│       │   ├── utils/                    # ตัวตรวจ Magic Bytes ของไฟล์ .glb (glTF v2)  [แฮม]
│       │   ├── modules/
│       │   │   ├── upload/               # รับไฟล์ .glb, preview, poster และบันทึกลง Storage  [แฮม]
│       │   │   └── cdn/                  # สตรีมไฟล์ .glb/.webp, ตรวจ embed_key, HTTP Range, หยุดส่งโมเดลที่ถูกซ่อน  [นนท์]
│       │   └── app.ts                    # Entry point ของ CDN Service (/api/models upload & /cdn/*)
│       ├── storage_data/                 # โฟลเดอร์เก็บไฟล์จริงตามค่า Hash (อยู่ใน .gitignore)
│       ├── tmp_uploads/                  # โฟลเดอร์พักไฟล์ขณะคำนวณ sha256 (อยู่ใน .gitignore)
│       ├── .env.example
│       ├── Dockerfile
│       └── package.json
│
├── frontend/                             # Next.js Frontend & WebGL Viewer (Port 3000) — ทั้งหมดเป็นของ เจี๊ยบ (ยกเว้นหน้าที่ระบุ)
│   ├── public/
│   │   └── embed.js                      # Web Component <vm-model>
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx                  # หน้าแรก Gallery ค้นหาและกรองโมเดล
│   │   │   ├── login/page.tsx            # หน้าเข้าสู่ระบบและสมัครสมาชิก
│   │   │   ├── upload/page.tsx           # หน้าอัปโหลด .glb + สร้างภาพ Poster ด้วย .toBlob() (เฉพาะคนขาย)
│   │   │   ├── me/page.tsx               # รายการที่ซื้อ, embed_key, ปุ่ม Regenerate Key
│   │   │   ├── models/[id]/page.tsx      # หน้ารายละเอียด + Embed Playground + ปุ่มซื้อ/ดาวน์โหลด
│   │   │   ├── embed/[id]/page.tsx       # หน้า Viewer สำหรับ Iframe (CSP frame-ancestors *)
│   │   │   ├── pay/mock/[id]/page.tsx    # (ใหม่) หน้าจ่ายเงินจำลอง  [ภีม]
│   │   │   ├── seller/page.tsx           # (ใหม่) แดชบอร์ดคนขาย + ปุ่มเปิดโหมดคนขาย  [ภีม]
│   │   │   └── admin/                    # (ใหม่) แดชบอร์ดแอดมิน
│   │   │       ├── page.tsx              #   ภาพรวมตัวเลขสรุป
│   │   │       ├── models/page.tsx       #   ตารางโมเดล + ปุ่มซ่อน/คืน
│   │   │       ├── users/page.tsx        #   ตารางผู้ใช้ + ปุ่มระงับ/คืนบัญชี
│   │   │       └── orders/page.tsx       #   รายการซื้อขายทั้งระบบ
│   │   ├── components/
│   │   │   ├── gallery/                  # การ์ดโมเดลพร้อม IntersectionObserver Lazy-load
│   │   │   ├── viewer/                   # 3D Canvas Viewer
│   │   │   └── playground/               # แผงปรับแต่งโมเดลและสร้างโค้ด HTML/React/Vue/WP
│   │   └── lib/
│   │       └── api.ts                    # ตัวแปรเชื่อมต่อไปยัง CORE_API_URL และ CDN_SERVICE_URL
│   ├── next.config.ts
│   ├── .env.example
│   ├── Dockerfile
│   └── package.json
│
├── supabase/
│   └── schema.sql                        # สคริปต์สร้างตาราง users, models, purchases, likes, comments
├── docker-compose.yml                    # รันทุก Microservices พร้อมกันด้วยคำสั่งเดียว
├── .gitignore
└── README.md
```

---

## 5. การแบ่งงานภายในทีม 6 คน

| สมาชิก | งานที่รับผิดชอบ | พื้นที่ในโปรเจกต์ |
| :--- | :--- | :--- |
| **เจี๊ยบ** (คู่ภีม) | หน้าเว็บทั้งหมด: Web Component `<vm-model>` และหน้าฝัง Iframe, หน้าแรก Gallery, หน้ารายละเอียด + Embed Playground, หน้าอัปโหลด + สร้าง Poster, หน้าล็อกอิน/สมัคร, หน้า `/me`, **แดชบอร์ดแอดมินทั้ง 4 หน้า** | `frontend/` (ยกเว้น `pay/mock/` และ `seller/`) | หลังบ้านแอดมิน |
| **ภีม** (คู่เจี๊ยบ) | ระบบซื้อจำลอง (checkout, ยืนยันจ่าย, สร้าง/Regenerate `embed_key`, รายการที่ซื้อ), หน้าจ่ายเงินจำลอง, แดชบอร์ดคนขาย (โมเดลของฉัน ยอดขาย ปุ่มเปิดโหมดคนขาย) | `core-api/src/modules/payments/`, `seller/`<br>`frontend/src/app/pay/`, `seller/` |
| **นนท์** (คู่เป้ก) | ระบบ CDN: ส่งไฟล์โมเดล/ภาพปก, ตรวจ `embed_key`, ดาวน์โหลดเฉพาะผู้มีสิทธิ์, HTTP Range, Cache, Rate limit, หยุดส่งโมเดลที่ถูกซ่อนหรือเจ้าของถูกระงับ | `cdn-service/src/modules/cdn/` |
| **แฮม** (คู่ต้า) | **ส่งภายในวันแรก:** ปรับ `schema.sql` (บทบาท, `is_seller`, `suspended_at`, `hidden_at`) และ middleware ตรวจผู้ใช้/บทบาท/รูปแบบ error จากนั้น: StorageAdapter, ตรวจไฟล์ GLB, รับอัปโหลด (เฉพาะคนขาย), ลบโมเดล (เจ้าของเท่านั้น, soft delete) | `supabase/`<br>`core-api/src/middlewares/`<br>`cdn-service/src/storage/`, `utils/`, `modules/upload/` |
| **ต้า** (คู่แฮม) | สมัครสมาชิก/ล็อกอิน (bcrypt + JWT, บัญชีที่ถูกระงับล็อกอินไม่ได้), เปิดโหมดคนขาย, ฝั่ง Backend ของหน้าผู้ใช้ในแดชบอร์ดแอดมิน (ดึงรายชื่อ ระงับ/คืนบัญชี) | `core-api/src/modules/auth/`<br>`core-api/src/modules/admin/` (ส่วนผู้ใช้) |
| **เป้ก** (คู่นนท์) | ดึงรายการ/ค้นหา/กรอง/แบ่งหน้า/รายละเอียดโมเดล (ไม่แสดงโมเดลที่ซ่อนหรือลบ และไม่ส่งลิงก์ไฟล์เต็มของโมเดลเสียเงิน) | `core-api/src/modules/models/`<br>`core-api/src/modules/admin/` (ส่วนโมเดลและรายการซื้อ) |

**ข้อควรระวัง**
- ระบบจ่ายเงินจำลองต้องเปิดได้เฉพาะเมื่อตั้ง `PAYMENT_PROVIDER=mock` และห้ามเปิดใน production
- การตรวจสิทธิ์คนขาย/แอดมินต้องทำที่ Backend เสมอ
- ถ้าเวลาไม่พอ ตัดตามลำดับ: หน้า `/me` → snippet หลายภาษาใน Playground → หน้าภาพรวมแอดมิน (เหลือตารางล้วน)

---

## 6. วิธีเริ่มต้นใช้งานโปรเจกต์ (Getting Started)

1. **Clone Dependencies**:
   Clone โปรเจกต์จาก GitHub ลงเครื่อง (`git clone <repository-url>` แล้ว `cd broken-design`) หากต้องการรันแบบ Local (ไม่ใช้ Docker) ให้รัน `npm install` ในแต่ละโฟลเดอร์ (`services/core-api`, `services/cdn-service`, และ `frontend`)
2. **ตั้งค่าฐานข้อมูล Supabase**:
   นำโค้ดใน `supabase/schema.sql` ไปรันใน SQL Editor ของ Supabase
3. **คัดลอกไฟล์ `.env`**:
   คัดลอกไฟล์ `.env.example` เป็น `.env` ในทั้ง 3 โฟลเดอร์ (`services/core-api`, `services/cdn-service`, และ `frontend`) แล้วใส่ค่า `DATABASE_URL` ของ Supabase (ห้าม commit ไฟล์ `.env`)
4. **รันระบบทั้งหมด**:
   สามารถรันผ่าน Docker Compose ได้ทันที:
   ```bash
   docker compose up --build
   ```
   หรือรันแยกแต่ละเซอร์วิสในโหมดพัฒนา (`npm run dev`) บนพอร์ต `3000`, `4000` และ `4001`
