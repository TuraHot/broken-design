# TASKS — Lixyte task board

อัปเดตล่าสุด: 2026-11-17 · สถานะตรวจจากโค้ดบน `main` หลัง merge PR #15 (`origin/kzwnjuy`), branch `origin/Pek`, และ branch `origin/ham` รวมถึงสร้างตาราง `complaints` บน PostgreSQL จริงแล้ว (ผลเทสต์ล่าสุดผ่านครบทั้งระบบ: `cdn-service` 23/23, `core-api` 48/48, `frontend` 4/4 = **75/75**)
คอลัมน์ **ผู้รับ** แบ่งตามหลักว่าแต่ละคนทำ Frontend ของ backend ที่ตัวเองดูแล แก้ได้เมื่อทีมปรับการแบ่งงาน (ตาราง §7 ใน `README.md`)

สถานะ: `[x]` ใช้ได้ · `[~]` ทำบางส่วน (UI อย่างเดียว / placeholder / ทำแค่ฝั่งเดียว) · `[ ]` ยังไม่มี

## 1. หน้าเว็บ (Frontend)

### สาธารณะและ login
| สถานะ | เส้นทาง | ผู้รับ | Backend ที่ใช้ | หมายเหตุ |
|---|---|---|---|---|
| [x] | `/` หน้าแรก | เจี๊ยบ | - | |
| [x] | `/gallery` | เป้ก | `GET /api/models` | ค้นหาและตัวกรอง tag / license / price ทำงานผ่าน URL แสดงเฉพาะโมเดลจริงจาก Core API (ตัดข้อมูลตัวอย่างออกแล้ว) คอมเมนต์หัวไฟล์ `page.tsx` ยังเขียนว่า "UI only" ซึ่งล้าสมัย |
| [x] | `/models/[id]` | นนท์ | `GET /api/models/:id`, CDN | viewer 3D จาก CDN, ดาวน์โหลด, เริ่มซื้อ ยังไม่มีถูกใจ/คอมเมนต์ และ Playground |
| [~] | `/creators/[handle]` | เจี๊ยบ | `/api/creators/:handle` (ไม่มี) | UI อ่านอย่างเดียว ข้อมูลตัวอย่าง |
| [x] | `/creator` | เจี๊ยบ | - | |
| [x] | `/docs` | เจี๊ยบ | - | คู่มือฝังโมเดล (`<vm-model>`, iframe, embed key, ดาวน์โหลด, การขาย, CDN, แก้ปัญหา) เนื้อหาเขียนจากพฤติกรรมจริงของระบบ ทีมควรอ่านตรวจความถูกต้อง |
| [x] | `/licenses` | เจี๊ยบ | - | การ์ด 4 ไลเซนส์ + ตารางเทียบ ใช้ข้อมูลจาก `lib/licenses.ts` **ยังไม่ได้ตัดสิน:** สิทธิ์แก้ไขโมเดลของไลเซนส์ COMMERCIAL (หน้าเขียนว่า "Not defined yet") |
| [~] | หน้ากฎหมาย `/terms`, `/privacy`, `/seller-terms`, `/refunds`, `/dmca`, `/licenses`, `/contact`, `/me`, `/seller`, `/settings`, `/upload`, `/checkout/[id]`, `/checkout/success`, `/pay/mock/[id]`, `/admin/*` (7 หน้า, ปุ่มสลับโทนอยู่ใน AdminShell), `/403` (ยังล็อกโทนมืดโดยตั้งใจ: `/embed/[id]` เพราะแสดงในเว็บคนอื่นและกำหนดพื้นหลังเองด้วย `?background=`, และหน้า 404 ของ path ที่ไม่มีอยู่จริง เพราะธีมตัดสินจาก path) | เจี๊ยบ | - | **ร่าง** เขียนตามที่ระบบทำจริง มีป้าย Draft และ `[TO DECIDE]` ทุกจุดที่ทีมยังไม่ตัดสิน (ผู้ให้บริการ/ที่อยู่, อีเมลติดต่อ, ค่าธรรมเนียม, การจ่ายเงินผู้ขาย, ระยะเวลาขอคืนเงิน, ระยะเก็บข้อมูล, กฎหมายที่ใช้) ต้องให้ผู้เชี่ยวชาญตรวจก่อนรับเงินจริง |
| [x] | แจ้งโมเดลละเมิด | เจี๊ยบ | `POST /api/complaints` | มี popup ส่งคำร้องเรียนแล้ว (ขาดปุ่มเปิดจากหน้า `/models/[id]`) |
| [x] | `/embed/[id]` | นนท์ | CDN | ถ้า key ผิดหรือถูกหมุน จะสลับไป `preview.glb` พร้อมแจ้งเตือน |
| [ ] | Playground `/models/[id]/embed` | นนท์ | - | `components/playground/` ว่างอยู่ |
| [x] | `/login` | ต้า | `POST /api/auth/check-email`, `/login`, `/register` | ต่อ core-api แล้ว เก็บ token ใน `localStorage` ปุ่ม Google ยังเป็น UI อย่างเดียว |
| [~] | `/forgot-password` | ต้า | ไม่มี endpoint | UI อย่างเดียว ตรวจอีเมลแล้วไม่ส่งอะไร |

### ผู้ซื้อ
| สถานะ | เส้นทาง | ผู้รับ | Backend ที่ใช้ | หมายเหตุ |
|---|---|---|---|---|
| [ ] | `/checkout/[id]` | ภีม | `POST /api/models/:id/checkout` | backend ใช้ได้ ตอนนี้ปุ่มซื้อบนหน้าโมเดลเรียก checkout ตรง ๆ |
| [ ] | `/pay/mock/[id]`, `/admin/*` (7 หน้า, ปุ่มสลับโทนอยู่ใน AdminShell), `/403` (ยังล็อกโทนมืดโดยตั้งใจ: `/embed/[id]` เพราะแสดงในเว็บคนอื่นและกำหนดพื้นหลังเองด้วย `?background=`, และหน้า 404 ของ path ที่ไม่มีอยู่จริง เพราะธีมตัดสินจาก path) | ภีม | `POST /api/purchases/:id/confirm-mock` | **checkout ส่งผู้ใช้มาหน้านี้ แต่หน้ายังไม่มี จึงเจอ 404** |
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
| [x] | `/admin/models` | เจี๊ยบ | `GET /api/admin/models`, `PATCH .../hide`, `PATCH .../license` | ทำแล้ว (ปุ่ม "แก้ไข" ปุ่มเดียวต่อแถว เปิดกล่องที่แก้ license พร้อมเหตุผล (ส่งใบเตือนให้เจ้าของ) และซ่อน/คืนสถานะ) ทดสอบในเบราว์เซอร์กับ API จำลอง (ยังไม่ได้ลองกับ core-api + Postgres จริง ต้องรัน SQL ของตาราง `model_license_changes` และ `notifications` ใน `schema.sql` ก่อน) |
| [x] | กระดิ่งแจ้งเตือนข้างรูปโปรไฟล์ใน Navbar (`components/notifications/NotificationBell.tsx`: ตัวเลขที่ยังไม่อ่าน, dropdown รายการล่าสุด, อ่านทีละอัน/ทั้งหมด; ใช้ API เดิม ไม่แสดงให้แอดมิน; ข้อความแจ้งเตือนใช้ร่วมกันผ่าน `NoticeContent.tsx`) | เจี๊ยบ | ใช้ `GET/PATCH /api/me/notifications` เดิม | ทำแล้ว |
| [x] | กล่องใบเตือนของเจ้าของ (`/seller` + ตัวนับในเมนู) | เจี๊ยบ | `GET /api/me/notifications`, `PATCH .../read`, `PATCH .../read-all` | ทำแล้ว ยังไม่มีอีเมล (จุดสร้างใบเตือนอยู่ที่เดียวใน SQL ของ route แก้ license) ไฟล์ `/seller` และ `AccountMenu` เป็นของคนอื่นร่วมกัน ควรให้เจ้าของไฟล์ตรวจ |
| [x] | `/admin/notifications` | เจี๊ยบ | `GET /api/admin/notifications`, `.../summary` | ทำแล้ว หน้ารวมสิ่งที่รอแอดมินอยู่ (ใบสมัครครีเอเตอร์ที่รอตรวจ + เรื่องร้องเรียนที่ยังเปิด) เรียงใหม่สุดก่อน แต่ละรายการมีปุ่มไปหน้าที่จัดการ (`/admin/creator-approvals`, `/admin/complaints`) และหายไปเมื่อจัดการแล้ว; sidebar แสดงตัวเลขที่รออยู่ข้างเมนู อัปเดตทันทีหลังจัดการและทุก 60 วินาที ทดสอบในเบราว์เซอร์กับ API จำลอง (ยังไม่ได้ลองกับ core-api + Postgres จริง) |
| [x] | `/admin/creator-approvals` | เจี๊ยบ | `GET/PATCH /api/admin/creator-applications`, `GET/POST /api/admin/invite-codes` | ทำแล้ว ย้ายกล่องใบสมัครและโค้ดเชิญออกจากหน้า Users มาเป็นหน้าของตัวเอง: กรอง รอตรวจ/อนุมัติแล้ว/ปฏิเสธแล้ว/ทั้งหมด, อนุมัติ, ปฏิเสธ (ถามยืนยัน), สร้างและดูโค้ดเชิญ; มีภาษาไทย/อังกฤษ |
| [x] | `/admin/users` | เจี๊ยบ | `GET /api/admin/users`, `PATCH .../suspend`, `DELETE .../users/:id` (ปุ่ม "ลบ" เปิดกล่องกรอกเหตุผลและคำเตือน แถวที่ถูกลบแสดงป้าย "ถูกลบ" พร้อมวันที่และเหตุผลและอีเมลเดิม ไม่มีปุ่มให้กดอีก) | ทำแล้ว ปุ่ม "ระงับ/คืนสถานะ" เปิดกล่องเลือกระยะเวลา (1/3/7/30 วัน, ถึงวันที่กำหนด, ไม่มีกำหนด) + เหตุผล และแสดงวันสิ้นสุดในรายการ ผู้ใช้ได้รับใบเตือนทุกครั้ง (ระงับ, ปลดเอง, หมดเวลาอัตโนมัติ) อ่านได้ใน `/me` และ `/seller` ทดสอบในเบราว์เซอร์กับ API จำลอง (ยังไม่ได้ลองกับ core-api + Postgres จริง ต้องรัน SQL ส่วนที่ 10 ใน `schema.sql` ก่อน: คอลัมน์ `suspended_until`, `suspension_reason` และตาราง `user_suspensions`) |
| [x] | `/admin/purchases` | เจี๊ยบ | `GET /api/admin/purchases`, `GET .../purchases/:id` | ทำแล้ว กรองสถานะ + ช่วงวันที่ และปุ่ม "รายละเอียด" เปิดกล่องดูการซื้อรายการเดียว (อ่านอย่างเดียว ไม่แสดง `embed_key`) ทดสอบในเบราว์เซอร์กับ API จำลอง (ยังไม่ได้ลองกับ core-api + Postgres จริง) ยังไม่มีคืนเงิน/ยกเลิกสิทธิ์ |
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
| [~] | `/settings` | เจี๊ยบ | แสดงโปรไฟล์ + ออกจากระบบ; เปลี่ยนรหัสผ่าน/แก้ชื่อ/ลบบัญชีขึ้นว่า "ยังไม่พร้อม" เพราะยังไม่มี endpoint |
| [x] | `/contact` | เจี๊ยบ | ปุ่ม Report (popup) + ลิงก์ DMCA/Docs/Licenses/Refunds; อีเมลซัพพอร์ตยัง `[TO DECIDE]` |
| [~] | โทนสว่าง/มืด (`lib/theme.ts`, ปุ่มใน Navbar, คุกกี้ `theme`): **หน้าที่เปิดโทนสว่างแล้ว: `/`, `/gallery`, `/models/[id]`, `/creator`, `/creators/[handle]`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/docs`, `/terms`, `/privacy`, `/seller-terms`, `/refunds`, `/dmca`, `/licenses`, `/contact`, `/me`, `/seller`, `/settings`, `/upload`, `/checkout/[id]`, `/checkout/success`, `/pay/mock/[id]`, `/admin/*` (7 หน้า, ปุ่มสลับโทนอยู่ใน AdminShell), `/403` (ยังล็อกโทนมืดโดยตั้งใจ: `/embed/[id]` เพราะแสดงในเว็บคนอื่นและกำหนดพื้นหลังเองด้วย `?background=`, และหน้า 404 ของ path ที่ไม่มีอยู่จริง เพราะธีมตัดสินจาก path)** (ย้ายทีละหน้า ดูรายการใน `THEME_READY_ROUTES`) **ขั้นที่ 1–5 เสร็จแล้ว** (ขั้นที่ 5: หน้า `/` ใช้สี token ครบและเปิดโทนสว่างแล้ว — `THEME_READY_ROUTES = ['/']` ปุ่มสลับโทนแสดงที่หน้านี้; หน้าอื่นยังล็อกเป็นโทนมืด) (ขั้นที่ 4: ดอก Lily ย้ายเข้ากรอบ hero ลบเอฟเฟกต์แตกกระจาย มีดอกบานเต็มในโทนมืด/ดอกตูมเส้นหมึกในโทนสว่าง หยุดวาดเมื่อพ้นจอ ภาพนิ่งเมื่อลดการเคลื่อนไหว และส่งค่าจริงให้ชิปสถานะ) (ขั้นที่ 3: hero ใหม่ตามภาพจำลอง ชื่อ 3 บรรทัด กรอบกริดฝั่งขวาที่ชิป/กล่องพิกัดอ่านค่าจริงจาก `lib/lily-telemetry.ts` (ตอนนี้ยังว่างจนกว่าขั้นที่ 4 จะส่งค่า), ลูกศรเลื่อนลงและจุดนำทางขวา, ฟอนต์ Barlow Condensed/JetBrains Mono ในโทนสว่าง; ที่ 360px ซ่อนลิงก์ "ล็อกอิน" เมื่อจอแคบกว่า 375px) (ขั้นที่ 2: Navbar, Footer, สลับภาษา, เมนูบัญชี, กระดิ่ง, อวาตาร์ ใช้สี token แล้ว; ที่ 360px ซ่อนลิงก์ Creator เมื่อจอแคบกว่า 375px เพื่อให้ปุ่มสลับธีมพอดี) (ระบบสี, สคริปต์ตั้งธีมก่อนวาดหน้า, ปุ่มสลับ; `THEME_READY_ROUTES` ยังว่าง จึงยังไม่เห็นผลบนหน้าไหน) ขั้นต่อไป: ย้าย Navbar/Footer/Landing ไปใช้สี token, hero ใหม่, ดอก Lily ตูม (ดู `docs/superpowers/specs/2026-11-20-landing-theme-design.md`) | เจี๊ยบ | - | กำลังทำ |
| [~] | สลับภาษา EN/ไทย (`lib/i18n/`, ปุ่มใน Navbar, คุกกี้ `lang`) | เจี๊ยบ | แปลแล้ว: Navbar, Footer, เมนู User, popup Report, `/contact`, `/settings`, `/docs`, `/licenses`, หน้ากฎหมายทั้ง 5 (ไฟล์ `th.tsx` ข้าง `page.tsx`; ฉบับไทยยังต้องให้ผู้เชี่ยวชาญตรวจ); `/admin` ทั้ง 5 หน้า (ข้อความจาก API ยังเป็นอังกฤษ); **ชุด A เสร็จแล้ว:** `/login`, `/register`, `/forgot-password`, `/reset-password`, `/docs`, `/terms`, `/privacy`, `/seller-terms`, `/refunds`, `/dmca`, `/licenses`, `/contact`, `/me`, `/seller`, `/settings`, `/upload`, `/checkout/[id]`, `/checkout/success`, `/pay/mock/[id]`, `/admin/*` (7 หน้า, ปุ่มสลับโทนอยู่ใน AdminShell), `/403` (ยังล็อกโทนมืดโดยตั้งใจ: `/embed/[id]` เพราะแสดงในเว็บคนอื่นและกำหนดพื้นหลังเองด้วย `?background=`, และหน้า 404 ของ path ที่ไม่มีอยู่จริง เพราะธีมตัดสินจาก path), หน้า `403`, `404`, `500`, หน้าโหลด/แถบนำทาง และ `/embed` (ใส่ `?lang=th` ที่ iframe เพราะคุกกี้ไม่ถูกส่งในเว็บอื่น); **ชุด D เสร็จแล้ว (แปลครบทุกหน้า):** `/checkout/[id]`, `/checkout/success`, `/pay/mock/[id]` (สถานะคำสั่งซื้อ ข้อความผิดพลาด สัญญาอนุญาต); **ชุด C เสร็จแล้ว:** `/me`, `/seller` (กระเป๋าเงิน ตาราง คำสั่งซื้อ), `/upload` (สัญญาอนุญาต ข้อความผิดพลาด) และส่วนที่เหลือของ `/settings`/อวาตาร์ (ข้อความจากเซิร์ฟเวอร์ยังเป็นภาษาที่เซิร์ฟเวอร์เขียน); **ชุด B เสร็จแล้ว:** Landing `/`, `/gallery` (ตัวกรอง แท็ก ราคา การแบ่งหน้า การ์ดโมเดล), `/models/[id]` (ปุ่มซื้อ/ดาวน์โหลด ตัวอย่าง 3D โค้ดฝัง ปุ่มถูกใจ สัญญาอนุญาต), `/creator`, `/creators/[handle]`, `/login`, `/register`, `/forgot-password`, `/reset-password` (แปลชื่อแท็กของแกลเลอรี ส่วนแท็กที่ครีเอเตอร์พิมพ์เองแสดงตามที่เขียน); **ยังเป็นอังกฤษ:** ชุด C (`/me`, `/seller`, `/upload`, ส่วนที่เหลือของ `/settings`), ชุด D (`/checkout/*`, `/pay/mock/*`). เพิ่มข้อความ UI เป็นไฟล์ตามพื้นที่ใน `lib/i18n/messages/<พื้นที่>.ts` (ต้องมีทั้ง en และ th แล้วรวมเข้า `messages.ts` ด้วย `...xxxEn` / `...xxxTh`); แก้หน้ายาวต้องแก้ทั้ง `page.tsx` และ `th.tsx` |
| [ ] | `/verify` ตรวจลายน้ำ (endpoint `POST /cdn/verify-watermark` พร้อมแล้ว) | นนท์ |
| [ ] | ที่ฉันบันทึก + ถูกใจ/คอมเมนต์ | ยังไม่มีผู้รับ (`modules/interactions/` ยังเป็น stub) |

## 2. Backend

### ใช้ได้แล้ว
| สถานะ | งาน | ผู้รับ | หมายเหตุ |
|---|---|---|---|
| [x] | `POST /api/auth/check-email`, `/register`, `/login` | ต้า | บัญชีที่ถูกระงับได้ `403 ACCOUNT_SUSPENDED` (มีเทสต์ 2 ข้อ) |
| [x] | `GET /api/models` (`q`, `tag`, `license`, `price`, `page`, `pageSize`), `GET /api/models/:id` | เป้ก | ซ่อนโมเดลที่ถูกซ่อน/ลบ/เจ้าของถูกระงับ |
| [x] | `DELETE /api/models/:id` (soft delete) | แฮม | เจ้าของหรือแอดมิน |
| [x] | payments: `checkout`, `confirm-mock`, `pay-mock`, `me/purchases`, `regenerate-key`, `purchases/:id` | ภีม | มีเทสต์ 15 ข้อ (เพิ่ม 3 ข้อ: บัญชีที่ถูกระงับซื้อ/แก้คีย์ไม่ได้, ไม่พบบัญชี = 401, อ่านรายการซื้อยังได้) |
| [x] | `/api/seller/enable`, `status`, `models`, `sales` | ภีม | มีเทสต์ 5 ข้อ |
| [x] | `POST /api/complaints` & `/api/admin/complaints` (`GET`, `PATCH`) | เจี๊ยบ | มีเทสต์ complaints 5 ข้อ + admin 38 ข้อ (รวม sweeper 2) + notifications 6 ข้อ + CORS 4 ข้อ (รวม Core API 83 ข้อ รวมเทสต์ schema 2 ข้อและเทสต์ล็อกอิน) |
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
| [x] | `PATCH /api/admin/models/:id/hide` | เจี๊ยบ | body `{ hidden, reason? }` ซ่อนต้องมีเหตุผล บันทึกประวัติและส่งใบเตือนเจ้าของ (ต้องรัน SQL ส่วนที่ 11 ใน `schema.sql`: ตาราง `model_visibility_changes`); ปุ่มซ่อน/คืนสถานะใน `/admin/complaints` ใช้ฟอร์มเหตุผลเดียวกัน (คืนสถานะมีช่องเหตุผลไม่บังคับ) และ API ปฏิเสธโมเดลที่ถูกลบแล้ว (404) |
| [x] | `GET /api/admin/purchases` และ `GET /api/admin/purchases/:id` | เจี๊ยบ | ผู้ซื้อ โมเดล ราคา `watermark_hash` (ไม่ส่ง `embed_key`) กรอง `status`, `from`, `to` |
| [x] | `DELETE /api/admin/users/:id` | เจี๊ยบ | ลบบัญชีแบบเก็บประวัติ ต้องมีเหตุผล 10–1000 ตัวอักษร ห้ามลบตัวเองและแอดมิน อีเมลเดิมว่างให้สมัครใหม่ได้เป็นบัญชีใหม่ โมเดลหายจากแกลเลอรีแต่ผู้ซื้อเดิมยังใช้ได้ โทเค็นเดิมใช้ไม่ได้ทันที (`401 ACCOUNT_DELETED`) เทสต์ผ่านกับ DB จำลอง (ยังไม่ได้ลองกับ Postgres จริง ต้องรัน SQL ส่วนที่ 13 ใน `schema.sql` ก่อน) |
| [x] | `GET /api/admin/users`, `PATCH /api/admin/users/:id/suspend` | เจี๊ยบ | body `{ suspended, reason?, until? }` ระงับต้องมีเหตุผล ห้ามระงับตัวเองและห้ามระงับแอดมิน; `GET .../users/:id/suspensions` และ `GET .../models/:id/history` ดูประวัติ (แสดงในกล่องระงับและกล่องแก้ไขโมเดล); ตัวกวาดใน core-api ปลดเมื่อหมดเวลา (ทุก 60 วินาที) |
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
| [x] | ทำ Navbar ให้อ่าน token แล้วเปลี่ยนเป็นเมนูบัญชี (Library, Seller, Admin เฉพาะแอดมิน, Log out) | เจี๊ยบ | `components/AccountMenu.tsx` + `lib/session.ts` เชื่อมต่อลิงก์ `/me`, `/seller`, `/settings`, `/upload`, `/checkout/[id]`, `/checkout/success`, `/pay/mock/[id]`, `/admin/*` (7 หน้า, ปุ่มสลับโทนอยู่ใน AdminShell), `/403` (ยังล็อกโทนมืดโดยตั้งใจ: `/embed/[id]` เพราะแสดงในเว็บคนอื่นและกำหนดพื้นหลังเองด้วย `?background=`, และหน้า 404 ของ path ที่ไม่มีอยู่จริง เพราะธีมตัดสินจาก path), และ `/admin` ที่สร้างเสร็จทั้งหมดแล้ว |
| [ ] | ทำตัวส่ง request กลาง (`apiFetch`) ที่แนบ token และจัดการ error รูปแบบเดียวกัน | ต้า | ตอนนี้ `lib/auth.ts` กับหน้าอื่นเรียก `fetch` แยกกัน |
| [ ] | แยก `frontend/src/lib/api.ts` เป็น `lib/api/{models,auth,purchases,admin}.ts` | ต้า | กันคนแก้ไฟล์เดียวชนกัน |
| [ ] | เลือกชื่อเส้นทางเดียว: `/me` หรือ `/library`, `/admin/purchases` หรือ `/admin/orders` | ทั้งทีม | |
| [ ] | ตัดสินใจเรื่องระบบถูกใจ/คอมเมนต์ว่าอยู่ใน v1 หรือไม่ | ทั้งทีม | ถ้าเปิดต้องมีระบบกลั่นกรอง |
| [ ] | ระบบเสริม: อีเมลระบบ, ใบเสร็จ/ใบอนุญาต, onboarding หลังซื้อ, FAQ, แบนเนอร์คุกกี้, ปุ่มแชร์ + Open Graph, ล็อก key ผูกโดเมน, สถิติการใช้ key | ยังไม่มีผู้รับ | ยังไม่ได้เริ่ม |

## 5. กติกาตอนส่งงาน
- ตรวจชนิดข้อมูลและเทสต์ก่อนส่ง: `cd frontend && npx tsc --noEmit -p . && npm test` และ `cd services/core-api && npx tsc --noEmit -p . && npm test` และ `cd services/cdn-service && npx tsc --noEmit -p . && npm test` (บน Windows PowerShell ที่ติดนโยบาย ใช้ `npx.cmd` / `npm.cmd`) ต้องรัน `npm install` ในแต่ละโฟลเดอร์ก่อน
- ห้ามรัน `npm run build` ขณะ `npm run dev` เปิดอยู่
- ตรวจหน้าเว็บที่ 375px ก่อนส่ง และอ่าน `docs/DESIGN_SYSTEM.md` ก่อนทำ UI
- ตรวจสิทธิ์ที่ backend เสมอ ฝั่งหน้าเว็บซ่อนเมนูได้อย่างเดียว (`AGENT.md` ข้อ 3.2)
- ห้ามนำไฟล์ `.env` ขึ้น git แก้ `.env.example` เฉพาะชื่อตัวแปรและค่าตัวอย่าง
