# Broken Design — 3D Asset Repository & WebGL CDN Platform

**Broken Design** คือแพลตฟอร์ม **"Google Fonts สำหรับโลก 3 มิติ"** ศูนย์กลางในการจัดเก็บ ค้นหา และสตรีมไฟล์โมเดล 3 มิติมาตรฐาน `.glb` (Binary glTF) สำหรับนักพัฒนาเว็บและครีเอเตอร์ รองรับการฝังโมเดลลงบนเว็บไซต์ภายนอก (Embed) ผ่าน `<iframe>` และ Web Component `<vm-model>` แบบข้ามโดเมน (Cross-Origin CDN) โดยไม่ต้องดาวน์โหลดหรือโฮสต์ไฟล์เอง

---

## 1. สถาปัตยกรรมระบบแบบ Microservices (System Architecture)

โปรเจกต์ **Broken Design** แยกส่วน Backend ออกเป็น **2 Microservices** ตามลักษณะการใช้ทรัพยากร เพื่อป้องกันไม่ให้การอัปโหลดและสตรีมไฟล์ 3 มิติขนาดใหญ่กระทบต่อความเร็วของระบบ API หลัก:

| เซอร์วิส / โฟลเดอร์ | พอร์ต | เทคโนโลยีหลัก | หน้าที่รับผิดชอบ |
| :--- | :---: | :--- | :--- |
| **`frontend/`** | `3000` | Next.js (App Router), Tailwind CSS, `@google/model-viewer` | หน้าเว็บ Gallery, Embed Playground, หน้า `/embed/[id]` สำหรับ Iframe และสคริปต์ `public/embed.js` (`<vm-model>`) |
| **`services/core-api/`** | `4000` | Express 5, TypeScript, JWT, bcrypt, Stripe | จัดการระบบสมาชิก (`auth`), ข้อมูลแคตตาล็อกและการค้นหา (`models`), ระบบซื้อขายและสร้างคีย์ (`payments`), รวมถึงการกดถูกใจและความคิดเห็น (`interactions`) |
| **`services/cdn-service/`** | `4001` | Express 5, TypeScript, Multer, Node Streams | รับอัปโหลดไฟล์ `.glb` (สูงสุด 50 MB), ตรวจ Magic Bytes (`glTF` v2), เก็บไฟล์ด้วย `sha256` ลง `LocalDiskStorage` และสตรีมไฟล์ผ่าน `/cdn/*` (รองรับ CORS, Cache, HTTP Range) |
| **`supabase/`** | `5432` | Supabase PostgreSQL | ฐานข้อมูลกลางสำหรับเก็บตาราง `users`, `models` (`tags text[]`), `purchases`, `likes`, และ `comments` |

---

## 2. เทคโนโลยีที่ใช้พัฒนา (Tech Stack)

- **Frontend & 3D WebGL (`frontend/`)**
  - **Framework & Styling**: Next.js 15 (App Router), React 19, TypeScript 5, Tailwind CSS 3, Lucide React
  - **3D Rendering & Embed**: `@google/model-viewer` v4, Three.js, Web Components (`<vm-model>`), มาตรฐานไฟล์ Binary glTF 2.0 (`.glb`)
- **Backend — Core API (`services/core-api/`)**
  - **Runtime & Framework**: Node.js 22, Express 5, TypeScript 5 (`tsx`)
  - **Auth, Validation & Security**: JSON Web Token (`jsonwebtoken`), `bcrypt`, `zod`, `express-rate-limit`, `cors`
  - **Payments**: Stripe SDK (`stripe`) และระบบ Mock Checkout
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

## 3. โครงสร้างโฟลเดอร์โปรเจกต์ (Project Structure)

```text
broken-design/
├── services/
│   ├── core-api/                         # [Microservice 1] Core Business Logic API (Port 4000)
│   │   ├── src/
│   │   │   ├── config/                   # ตั้งค่าการเชื่อมต่อ Supabase DB และ Environment Variables
│   │   │   ├── middlewares/              # JWT Auth Middleware และ Standard Error Handler
│   │   │   ├── modules/
│   │   │   │   ├── auth/                 # [Member 1] สมัครสมาชิก, ล็อกอิน (bcrypt + JWT)
│   │   │   │   ├── models/               # [Member 3, 4] CRUD ข้อมูลโมเดล, Search, Filter, Pagination
│   │   │   │   ├── payments/             # [Member 6] Checkout, Stripe/Mock Webhook, Regenerate embed_key
│   │   │   │   └── interactions/         # [Member 6] ระบบกดถูกใจ (Likes) และความคิดเห็น (Comments)
│   │   │   └── app.ts                    # Entry point ของ Core API (/api/*)
│   │   ├── .env.example
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   └── cdn-service/                      # [Microservice 2] High-I/O Upload & 3D Streaming CDN (Port 4001)
│       ├── src/
│       │   ├── config/                   # ตั้งค่าขนาดไฟล์สูงสุดและโฟลเดอร์ Storage
│       │   ├── storage/                  # [Member 2] StorageAdapter Interface & LocalDiskStorage (sha256)
│       │   ├── utils/                    # [Member 2] ตัวตรวจ Magic Bytes ของไฟล์ .glb (glTF v2)
│       │   ├── modules/
│       │   │   ├── upload/               # [Member 2] รับไฟล์ .glb, preview, poster และบันทึกลง Storage
│       │   │   └── cdn/                  # [Member 5] สตรีมไฟล์ .glb/.webp, ตรวจ embed_key, HTTP Range
│       │   └── app.ts                    # Entry point ของ CDN Service (/api/models upload & /cdn/*)
│       ├── storage_data/                 # โฟลเดอร์เก็บไฟล์จริงตามค่า Hash (อยู่ใน .gitignore)
│       ├── tmp_uploads/                  # โฟลเดอร์พักไฟล์ขณะคำนวณ sha256 (อยู่ใน .gitignore)
│       ├── .env.example
│       ├── Dockerfile
│       └── package.json
│
├── frontend/                             # Next.js Frontend & WebGL Viewer (Port 3000)
│   ├── public/
│   │   └── embed.js                      # [Member 5] Web Component <vm-model>
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx                  # [Member 4] หน้าแรก Gallery ค้นหาและกรองโมเดล
│   │   │   ├── login/page.tsx            # [Member 1] หน้าเข้าสู่ระบบและสมัครสมาชิก
│   │   │   ├── upload/page.tsx           # [Member 2] หน้าอัปโหลด .glb + สร้างภาพ Poster ด้วย .toBlob()
│   │   │   ├── me/page.tsx               # [Member 3, 6] แดชบอร์ด Creator, ประวัติการซื้อ, ปุ่ม Regenerate Key
│   │   │   ├── models/[id]/page.tsx      # [Member 5, 6] หน้ารายละเอียด + Embed Playground + ปุ่มซื้อ
│   │   │   └── embed/[id]/page.tsx       # [Member 5] หน้า Viewer สำหรับ Iframe (CSP frame-ancestors *)
│   │   ├── components/
│   │   │   ├── gallery/                  # [Member 4] การ์ดโมเดลพร้อม IntersectionObserver Lazy-load
│   │   │   ├── viewer/                   # [Member 5] 3D Canvas Viewer
│   │   │   └── playground/               # [Member 5] แผงปรับแต่งโมเดลและสร้างโค้ด HTML/React/Vue/WP
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

## 4. การแบ่งงานภายในทีม 6 คน (Team Vertical Slicing)

แต่ละคนรับผิดชอบฟีเจอร์แบบครบวงจรตั้งแต่ฐานข้อมูล เซอร์วิสที่เกี่ยวข้อง ไปจนถึงหน้าบ้านโดยไม่ทับซ้อนไฟล์กัน:

| สมาชิก | ฟีเจอร์ที่รับผิดชอบ | โฟลเดอร์ Backend ที่รับผิดชอบ | โฟลเดอร์ Frontend ที่รับผิดชอบ |
| :---: | :--- | :--- | :--- |
| **Member 1** | ระบบผู้ใช้และยืนยันตัวตน (Auth & JWT) | `services/core-api/src/modules/auth/` | `frontend/src/app/login/` |
| **Member 2** | ระบบอัปโหลด ตรวจไฟล์ GLB และ Storage | `services/cdn-service/src/storage/`<br>`services/cdn-service/src/modules/upload/` | `frontend/src/app/upload/` |
| **Member 3** | ระบบจัดการข้อมูลโมเดลและแดชบอร์ด Creator | `services/core-api/src/modules/models/` (CRUD) | `frontend/src/app/me/` (ส่วนผลงานของฉัน) |
| **Member 4** | ระบบค้นหา กรองแท็ก และหน้าแกลเลอรี | `services/core-api/src/modules/models/` (Search API) | `frontend/src/app/page.tsx`<br>`frontend/src/components/gallery/` |
| **Member 5** | ระบบ 3D CDN Streaming, Embed & Playground | `services/cdn-service/src/modules/cdn/` | `frontend/public/embed.js`<br>`frontend/src/app/embed/[id]/`<br>`frontend/src/components/playground/` |
| **Member 6** | ระบบชำระเงิน, `embed_key`, Likes, Comments และสถิติการใช้งาน | `services/core-api/src/modules/payments/`<br>`services/core-api/src/modules/interactions/` | `frontend/src/app/models/[id]/` (ส่วนซื้อขาย/โซเชียล)<br>`frontend/src/app/me/` (ส่วนรายการที่ซื้อ) |

---

## 5. วิธีเริ่มต้นใช้งานโปรเจกต์ (Getting Started)

1. **Clone Dependencies**:
   Clone โปรเจกต์จาก GitHub ลงเครื่อง (`git clone <repository-url>` แล้ว `cd broken-design`) หากต้องการรันแบบ Local (ไม่ใช้ Docker) ให้รัน `npm install` ในแต่ละโฟลเดอร์ (`services/core-api`, `services/cdn-service`, และ `frontend`)
2. **ตั้งค่าฐานข้อมูล Supabase**:
   นำโค้ดใน `supabase/schema.sql` ไปรันใน SQL Editor ของ Supabase
3. **คัดลอกไฟล์ `.env`**:
   คัดลอกไฟล์ `.env.example` เป็น `.env` ในทั้ง 3 โฟลเดอร์ (`services/core-api`, `services/cdn-service`, และ `frontend`) แล้วใส่ค่า `DATABASE_URL` ของ Supabase
4. **รันระบบทั้งหมด**:
   สามารถรันผ่าน Docker Compose ได้ทันที:
   ```bash
   docker compose up --build
   ```
   หรือรันแยกแต่ละเซอร์วิสในโหมดพัฒนา (`npm run dev`) บนพอร์ต `3000`, `4000` และ `4001`