# TASKS — Lixyte task board

อัปเดตล่าสุด: 2026-11-17 · สถานะตรวจจากโค้ดบน `main` หลัง merge PR #15 (`origin/kzwnjuy`), branch `origin/Pek`, และ branch `origin/ham` รวมถึงสร้างตาราง `complaints` บน PostgreSQL จริงแล้ว (ผลเทสต์ล่าสุดผ่านครบทั้งระบบ: `cdn-service` 23/23, `core-api` 48/48, `frontend` 4/4 = **75/75**)
คอลัมน์ **ผู้รับ** แบ่งตามหลักว่าแต่ละคนทำ Frontend ของ backend ที่ตัวเองดูแล แก้ได้เมื่อทีมปรับการแบ่งงาน (ตาราง §7 ใน `README.md`)

สถานะ: `[x]` ใช้ได้ · `[~]` ทำบางส่วน (UI อย่างเดียว / placeholder / ทำแค่ฝั่งเดียว) · `[ ]` ยังไม่มี

## 1. หน้าเว็บ (Frontend)

### สาธารณะและ login
| สถานะ | เส้นทาง | ผู้รับ | Backend ที่ใช้ | หมายเหตุ |
|---|---|---|---|---|
| [x] | `/` หน้าแรก | เจี๊ยบ | - | |
| [x] | `/gallery` | เป้ก | `GET /api/models` | ค้นหาและตัวกรอง tag / license / price ทำงานผ่าน URL รวมข้อมูลจริงกับข้อมูลตัวอย่าง (ปิดข้อมูลตัวอย่างด้วย `NEXT_PUBLIC_USE_MOCK=false`) คอมเมนต์หัวไฟล์ `page.tsx` ยังเขียนว่า "UI only" ซึ่งล้าสมัย |
| [x] | `/models/[id]` | นนท์ | `GET /api/models/:id`, CDN | viewer 3D จาก CDN, ดาวน์โหลด, เริ่มซื้อ ยังไม่มีถูกใจ/คอมเมนต์ และ Playground |
| [~] | `/creators/[handle]` | เจี๊ยบ | `/api/creators/:handle` (ไม่มี) | UI อ่านอย่างเดียว ข้อมูลตัวอย่าง |
| [x] | `/creator` | เจี๊ยบ | - | |
| [ ] | `/docs` | เจี๊ยบ | - | ลิงก์ในเมนูยังชี้ไปหน้าที่ไม่มี ต้องมีคนเขียนเนื้อหา |
| [ ] | `/licenses` | เจี๊ยบ | - | อธิบายไลเซนส์แบบตาราง ทำได้/ทำไม่ได้ |
| [ ] | หน้ากฎหมาย (Terms, Privacy, Seller terms, คืนเงิน, DMCA) | เจี๊ยบ | - | ต้องให้ผู้เชี่ยวชาญตรวจเนื้อหา |
| [x] | แจ้งโมเดลละเมิด | เจี๊ยบ | `POST /api/complaints` | มี popup ส่งคำร้องเรียนแล้ว (ขาดปุ่มเปิดจากหน้า `/models/[id]`) |
| [x] | `/embed/[id]` | นนท์ | CDN | ถ้า key ผิดหรือถูกหมุน จะสลับไป `preview.glb` พร้อมแจ้งเตือน |
| [ ] | Playground `/models/[id]/embed` | นนท์ | - | `components/playground/` ว่างอยู่ |
| [x] | `/login` | ต้า | `POST /api/auth/check-email`, `/login`, `/register` | ต่อ core-api แล้ว เก็บ token ใน `localStorage` ปุ่ม Google ยังเป็น UI อย่างเดียว |
| [~] | `/forgot-password` | ต้า | ไม่มี endpoint | UI อย่างเดียว ตรวจอีเมลแล้วไม่ส่งอะไร |

### ผู้ซื้อ
| สถานะ | เส้นทาง | ผู้รับ | Backend ที่ใช้ | หมายเหตุ |
|---|---|---|---|---|
| [ ] | `/checkout/[id]` | ภีม | `POST /api/models/:id/checkout` | backend ใช้ได้ ตอนนี้ปุ่มซื้อบนหน้าโมเดลเรียก checkout ตรง ๆ |
| [ ] | `/pay/mock/[id]` | ภีม | `POST /api/purchases/:id/confirm-mock` | **checkout ส่งผู้ใช้มาหน้านี้ แต่หน้ายังไม่มี จึงเจอ 404** |
| [ ] | `/checkout/success` | ภีม | `GET /api/purchases/:id` | แสดง embed key และโค้ดทันที |
| [x] | `/me` | ภีม / แฮม | `GET /api/me/purchases`, `POST /api/purchases/:id/regenerate-key` | เชื่อมต่อแล้ว (Merged `origin/ham`): แสดงโปรไฟล์, ปุ่มเปิดคนขาย, embed_key, copy snippet, regenerate key และดาวน์โหลด `.glb` |

### ผู้ขาย
| สถานะ | เส้นทาง | ผู้รับ | Backend ที่ใช้ | หมายเหตุ |
|---|---|---|---|---|
| [x] | `/seller` | ภีม / แฮม | `/api/seller/status`, `/models`, `/sales`, `/enable`, `DELETE /api/models/:id` | เชื่อมต่อแล้ว (Merged `origin/ham`): แสดงรายได้, ยอดขาย, รายการโมเดล และปุ่ม Soft Delete |
| [x] | `/upload` | แฮม | `POST /api/models` (CDN) | มีพรีวิว 3D และจับภาพปก ดูปัญหา token ฝังโค้ดในส่วนที่ 3 |
| [ ] | `/seller/models/[id]` แก้และลบโมเดล | แฮม | `PATCH`, `DELETE /api/models/:id` | `DELETE` ใช้ได้ `PATCH` ยังเป็น TODO |

### แอดมิน
| สถานะ | เส้นทาง | ผู้รับ | Backend ที่ใช้ | หมายเหตุ |
|---|---|---|---|---|
| [x] | `/admin` ภาพรวม | เจี๊ยบ | `GET /api/admin/overview` | ทำแล้ว ทดสอบในเบราว์เซอร์กับ API จำลอง (ยังไม่ได้ลองกับ core-api + Postgres จริง) |
| [x] | `/admin/models` | เจี๊ยบ | `GET /api/admin/models`, `PATCH .../hide` | ทำแล้ว ทดสอบในเบราว์เซอร์กับ API จำลอง (ยังไม่ได้ลองกับ core-api + Postgres จริง) |
| [x] | `/admin/users` | เจี๊ยบ | `GET /api/admin/users`, `PATCH .../suspend` | ทำแล้ว ทดสอบในเบราว์เซอร์กับ API จำลอง (ยังไม่ได้ลองกับ core-api + Postgres จริง) |
| [x] | `/admin/purchases` | เจี๊ยบ | `GET /api/admin/purchases` | ทำแล้ว ใช้ชื่อ purchases (ยังไม่ได้ลองกับ core-api + Postgres จริง) |
| [x] | popup ส่งคำร้องเรียน (เมนู user + footer) + `/admin/complaints` | เจี๊ยบ | `POST /api/complaints`, `GET` / `PATCH /api/admin/complaints` ทดสอบแล้วในเบราว์เซอร์กับ API จำลอง (ยังไม่ได้ลองกับ Postgres จริง ต้องรัน SQL ของตาราง `complaints` ใน `schema.sql` ก่อน) |
| [ ] | ปุ่ม "Report" บนหน้า `/models/[id]` เรียก `useReport().openReport()` (เปิด popup และกรอกลิงก์โมเดลให้เอง) | นนท์ | ไฟล์ของนนท์ ยังไม่ได้แก้ |

### หน้าระบบ
| สถานะ | เส้นทาง | ผู้รับ | หมายเหตุ |
|---|---|---|---|
| [x] | `app/not-found.tsx` (404 ทั้งเว็บ) | เป้ก | Merged จาก branch `Pek` |
| [x] | `app/403/page.tsx` | เป้ก | Merged จาก branch `Pek` |
| [x] | `app/error.tsx` (500 ทั้งเว็บ) | เป้ก | Merged จาก branch `Pek` |
| [ ] | สถานะ WebGL ใช้ไม่ได้ | นนท์ | ทำใน viewer (`ModelPreview`, `EmbedIframeViewer`, `embed.js`) |

### ทำทีหลังได้
| สถานะ | เส้นทาง | ผู้รับ |
|---|---|---|
| [ ] | `/settings` (เปลี่ยนรหัสผ่าน ลบบัญชี) | ยังไม่มีผู้รับ |
| [ ] | `/contact` | ยังไม่มีผู้รับ |
| [ ] | `/verify` ตรวจลายน้ำ (endpoint `POST /cdn/verify-watermark` พร้อมแล้ว) | นนท์ |
| [ ] | ที่ฉันบันทึก + ถูกใจ/คอมเมนต์ | ยังไม่มีผู้รับ (`modules/interactions/` ยังเป็น stub) |

## 2. Backend

### ใช้ได้แล้ว
| สถานะ | งาน | ผู้รับ | หมายเหตุ |
|---|---|---|---|
| [x] | `POST /api/auth/check-email`, `/register`, `/login` | ต้า | บัญชีที่ถูกระงับได้ `403 ACCOUNT_SUSPENDED` (มีเทสต์ 2 ข้อ) |
| [x] | `GET /api/models` (`q`, `tag`, `license`, `price`, `page`, `pageSize`), `GET /api/models/:id` | เป้ก | ซ่อนโมเดลที่ถูกซ่อน/ลบ/เจ้าของถูกระงับ |
| [x] | `DELETE /api/models/:id` (soft delete) | แฮม | เจ้าของหรือแอดมิน |
| [x] | payments: `checkout`, `confirm-mock`, `pay-mock`, `me/purchases`, `regenerate-key`, `purchases/:id` | ภีม | มีเทสต์ 12 ข้อ |
| [x] | `/api/seller/enable`, `status`, `models`, `sales` | ภีม | มีเทสต์ 5 ข้อ |
| [x] | `POST /api/complaints` & `/api/admin/complaints` (`GET`, `PATCH`) | เจี๊ยบ | มีเทสต์ complaints 5 ข้อ + admin 20 ข้อ + CORS 4 ข้อ (รวม Core API 48 ข้อ) |
| [x] | cdn-service: อัปโหลด, สตรีม, ดาวน์โหลด, poster, ลายน้ำ 2 ชั้น, `verify-watermark`, rate limit | นนท์, แฮม | มีเทสต์ 23 ข้อ |

### ยังค้าง
| สถานะ | งาน | ผู้รับ | หมายเหตุ |
|---|---|---|---|
| [ ] | endpoint ลืมรหัสผ่าน | ต้า | หน้า `/forgot-password` รออยู่ |
| [ ] | rate limit ให้ `/api/auth/*` โดยเฉพาะ `check-email` | ต้า | ตอนนี้ใครก็ถามได้ว่าอีเมลไหนสมัครไว้แล้ว |
| [ ] | `PATCH /api/models/:id` | แฮม | ยังเป็น TODO |
| [x] | สร้าง `modules/admin/admin.routes.ts` และผูก `/api/admin` ใน `app.ts` | เจี๊ยบ | ตรวจ admin + `suspended_at` จากฐานข้อมูลในโมดูลเอง (`requireActiveAdmin`) แฮมจะย้ายไปรวมใน `auth.middleware.ts` ภายหลังก็ได้ |
| [x] | `GET /api/admin/overview` | เจี๊ยบ | ผู้ใช้ โมเดล คำสั่งซื้อ `paid` ยอดรวม (`amount_cents`) |
| [x] | `GET /api/admin/models` | เจี๊ยบ | รวมโมเดลที่ซ่อนและถูกลบ + เจ้าของ |
| [x] | `PATCH /api/admin/models/:id/hide` | เจี๊ยบ | body `{ hidden: boolean }` |
| [x] | `GET /api/admin/purchases` | เจี๊ยบ | ผู้ซื้อ โมเดล ราคา `watermark_hash` (ไม่ส่ง `embed_key`) |
| [x] | `GET /api/admin/users`, `PATCH /api/admin/users/:id/suspend` | เจี๊ยบ | body `{ suspended: boolean }` ห้ามระงับตัวเอง |
| [ ] | `/api/creators/:handle` | ยังไม่มีผู้รับ | ฝั่งหน้าเว็บเรียกไว้ตอนปิดข้อมูลตัวอย่าง |
| [~] | `modules/interactions/` (ถูกใจ, คอมเมนต์) | ยังไม่มีผู้รับ | ยังเป็น stub |
| [~] | Stripe webhook `POST /api/webhooks/stripe` | ภีม | stub ตอบ `received: true` ยังไม่ตรวจลายเซ็น (และต้องใช้ raw body) |

## 3. ความปลอดภัย (ทำก่อนใช้งานจริง)
รายละเอียดอยู่ใน `docs/ARCHITECTURE.md` ส่วน "Known issues"

| สถานะ | งาน | ผู้รับ | หมายเหตุ |
|---|---|---|---|
| [ ] | เอา `DEV_CREATOR_TOKEN` ออกจากโค้ด `frontend/src/app/upload/page.tsx` ไปไว้ใน `.env.local` | แฮม | เคยย้ายแล้ว แต่ merge ทำให้กลับมาเป็นค่าฝังในโค้ด token เดิมยังอยู่ในประวัติ git |
| [ ] | เลิกใช้ค่าตกหล่น `'dev-secret'` ของ `JWT_SECRET` และค่าตกหล่นของ `WATERMARK_SECRET` (ให้ระบบไม่ยอมเริ่มเมื่อไม่ตั้งค่าใน production) | แฮม | ทั้ง core-api และ cdn-service |
| [ ] | แก้ `requireAdmin` / `requireSeller` ให้ตรวจ role และ `suspended_at` จากฐานข้อมูล | แฮม | ตอนนี้เชื่อ role ใน JWT เท่านั้น (ฝั่ง seller router ตรวจฐานข้อมูลเองแล้ว) |
| [ ] | ตรึง `algorithms: ['HS256']` และตรวจ payload ของ JWT ตอน `jwt.verify` | แฮม | ทั้งสองบริการ |
| [ ] | ให้ CORS `*` ของ cdn-service ใช้เฉพาะ route สตรีม | นนท์ | อัปโหลดต้องใช้ token แล้ว แต่ CORS ยังเปิดหมด |
| [ ] | เปลี่ยนรหัสผ่านบัญชีตัวอย่าง (admin / creator) ก่อน deploy | แฮม | ค่าเริ่มต้นเขียนอยู่ใน `schema.sql`, `seedAdmin.ts` และ README |
| [ ] | ส่ง embed key ผ่าน header หรือ token อายุสั้นแทน query string | นนท์ | ตอนนี้ key รั่วลง log และ referrer ได้ |

## 4. งานโครงสร้างและเอกสาร

| สถานะ | งาน | ผู้รับ | หมายเหตุ |
|---|---|---|---|
| [x] | แก้ README ที่ชนกัน และอัปเดตเอกสาร `.md` ทั้งหมดหลัง merge PR #15 + `Pek` | เจี๊ยบ / ทีม | อัปเดตและจัดให้ตรงกับโค้ดบน `main` แล้ว |
| [x] | commit `docs/` (PRD, ARCHITECTURE, DESIGN_SYSTEM, TASKS) | เจี๊ยบ | Merged ลง `main` ใน PR #15 แล้ว |
| [x] | ทำ Navbar ให้อ่าน token แล้วเปลี่ยนเป็นเมนูบัญชี (Library, Seller, Admin เฉพาะแอดมิน, Log out) | เจี๊ยบ | `components/AccountMenu.tsx` + `lib/session.ts` เชื่อมต่อลิงก์ `/me`, `/seller`, และ `/admin` ที่สร้างเสร็จทั้งหมดแล้ว |
| [ ] | ทำตัวส่ง request กลาง (`apiFetch`) ที่แนบ token และจัดการ error รูปแบบเดียวกัน | ต้า | ตอนนี้ `lib/auth.ts` กับหน้าอื่นเรียก `fetch` แยกกัน |
| [ ] | แยก `frontend/src/lib/api.ts` เป็น `lib/api/{models,auth,purchases,admin}.ts` | ต้า | กันคนแก้ไฟล์เดียวชนกัน |
| [ ] | เลือกชื่อเส้นทางเดียว: `/me` หรือ `/library`, `/admin/purchases` หรือ `/admin/orders` | ทั้งทีม | |
| [ ] | ตัดสินใจเรื่องระบบถูกใจ/คอมเมนต์ว่าอยู่ใน v1 หรือไม่ | ทั้งทีม | ถ้าเปิดต้องมีระบบกลั่นกรอง |
| [ ] | ระบบเสริม: อีเมลระบบ, ใบเสร็จ/ใบอนุญาต, onboarding หลังซื้อ, FAQ, แบนเนอร์คุกกี้, ปุ่มแชร์ + Open Graph, สลับภาษา, ล็อก key ผูกโดเมน, สถิติการใช้ key | ยังไม่มีผู้รับ | ยังไม่ได้เริ่ม |

## 5. กติกาตอนส่งงาน
- ตรวจชนิดข้อมูลและเทสต์ก่อนส่ง: `cd frontend && npx tsc --noEmit -p . && npm test` และ `cd services/core-api && npx tsc --noEmit -p . && npm test` และ `cd services/cdn-service && npx tsc --noEmit -p . && npm test` (บน Windows PowerShell ที่ติดนโยบาย ใช้ `npx.cmd` / `npm.cmd`) ต้องรัน `npm install` ในแต่ละโฟลเดอร์ก่อน
- ห้ามรัน `npm run build` ขณะ `npm run dev` เปิดอยู่
- ตรวจหน้าเว็บที่ 375px ก่อนส่ง และอ่าน `docs/DESIGN_SYSTEM.md` ก่อนทำ UI
- ตรวจสิทธิ์ที่ backend เสมอ ฝั่งหน้าเว็บซ่อนเมนูได้อย่างเดียว (`AGENT.md` ข้อ 3.2)
- ห้ามนำไฟล์ `.env` ขึ้น git แก้ `.env.example` เฉพาะชื่อตัวแปรและค่าตัวอย่าง
