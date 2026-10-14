# UFUND Executive Dashboard

Dashboard สำหรับผู้บริหาร แสดงภาพรวมสัญญาสินเชื่อ ลูกหนี้ค้างชำระ และสถานะ MDM ของเครื่อง
ในหน้าเดียว กรองได้ตามยี่ห้อ สาขา ภูมิภาค ผู้ดูแล (RM/AM) และช่วงวันที่

## เรื่องมันเริ่มจากอะไร

เวอร์ชันแรกเป็น Google Apps Script ที่อ่านข้อมูลจาก Google Sheets ตรงๆ พอข้อมูลโตขึ้น
หน้าเว็บก็โหลดช้าและแก้หน้าตาได้ยาก
เลยย้ายมาทำเป็นเว็บแยก ที่เตรียมข้อมูลไว้ล่วงหน้า

## ระบบนี้ทำอะไร

```
ไฟล์ export สัญญา ─► SQLite (contracts.db) ─┐
ไฟล์สถานะ MDM ────► import-mdm.py ─────────┤
Google Sheets (บิลค้าง) ─► fetch-*.mjs ─────┴─► build ─► dashboard.json.gz ─► หน้าเว็บ (มี login)
```

- **เตรียมข้อมูลไว้ก่อน**: รวมข้อมูลจาก SQLite (~350 MB) เป็นก้อนสรุปที่บีบอัดแล้ว
  ผู้ใช้จึงโหลดแค่ข้อมูลที่ต้องใช้ ไม่ต้อง query ฐานข้อมูลทุกครั้งที่เปิดหน้า
- **จับคู่สถานะ MDM**: นำเข้าไฟล์สถานะ MDM ได้หลายรอบ เก็บทุกรอบไว้ และใช้ลำดับความสำคัญ
  (ไฟล์ใหม่สุดชนะ) จับคู่กับสัญญาด้วย IMEI หรือ Serial ของ Apple
- **หน้าเว็บ**: กราฟแนวโน้ม, กลุ่มค้างชำระ (OD bucket), สรุปตามสาขา/RM/AM,
  ตัวกรองที่ใช้ร่วมกันทุกแท็บ และคลิกเจาะดูรายละเอียดได้
- **ระบบ login**: ใช้รหัสผ่านเดียว คุก session เซ็นด้วย HMAC (HttpOnly, Secure, SameSite=Strict)
  เทียบรหัสแบบ constant-time และตั้ง security header (CSP, X-Frame-Options ฯลฯ)
- **deploy ได้ 2 ที่**: Vercel (serverless functions) หรือ Cloudflare Pages + KV
  สคริปต์ deploy ทำทุกอย่างในคำสั่งเดียว รวมถึงสร้าง KV ให้ครั้งแรก

## จุดที่ภูมิใจ

- **วัดผลก่อนตัดสินใจ** ตอนจะเพิ่มความละเอียดข้อมูลเป็นรายวัน กลัวว่าข้อมูลจะบวมจนเว็บช้า
  เลยวัดดูจริง พบว่าแถวที่ต้องรวมเพิ่มจาก ~537k เป็น ~579k (+7.7%) เท่านั้น และเวลาสลับแท็บแทบไม่เปลี่ยน
- **คิดเรื่องข้อมูลส่วนบุคคล (PDPA) ตั้งแต่แรก** ข้อมูลดิบ ไฟล์ Excel/CSV และ `.env`
  ไม่ขึ้น git เลย หน้าเว็บทุกหน้าต้อง login ก่อน
- **มีเทสต์** ตรวจว่าตัวเลขและตัวกรองบนหน้าเว็บตรงกับข้อมูลจริง

## เทคโนโลยีที่ใช้

Node.js 22 · SQLite (better-sqlite3) · Vanilla JS/CSS · Python (นำเข้า Excel) ·
Vercel / Cloudflare Pages + KV · node:test

## วิธีรัน

```bash
npm install
cp .env.example .env        # ตั้ง DASHBOARD_PASSWORD (8+ ตัว), SESSION_SECRET (32+ ตัว), Sheet ID
# วางไฟล์ data/contracts.db (ไม่อยู่ใน git เพราะเป็นข้อมูลจริง)
npm run build:data          # สร้างข้อมูลและหน้าเว็บ
npm start                   # เปิดที่ http://127.0.0.1:4191
```

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run build` | ดึงข้อมูลล่าสุดจาก Google Sheets แล้ว build หน้าเว็บใหม่ |
| `npm run build:data` | สร้างข้อมูลใหม่จาก `contracts.db` แล้ว build หน้าเว็บ |
| `python scripts/import-mdm.py "<ไฟล์ MDM>.xlsx"` | นำเข้าสถานะ MDM แล้วจับคู่กับสัญญาใหม่ |
| `npm test` | ทดสอบตัวเลขและตัวกรอง |
| `npm run deploy:cloudflare` | deploy ขึ้น Cloudflare Pages |

## โครงสร้างโปรเจกต์

```
client/        JS/CSS ของหน้าเว็บ (ถูกฝังเข้า public/index.html ตอน build)
source/        หน้าเว็บต้นฉบับจาก Apps Script (ใช้เป็นแม่แบบตอน build)
scripts/       build ข้อมูล, ดึง Google Sheets, นำเข้า MDM, deploy
api/ lib/      ระบบ login + ส่งข้อมูล (รันในเครื่องและบน Vercel)
functions/     ระบบเดียวกันสำหรับ Cloudflare Pages
test/          เทสต์
```

## หมายเหตุ

โปรเจกต์นี้ทำขึ้นระหว่างทำงานจริง repo นี้มีแค่โค้ด ไม่มีข้อมูลสัญญาหรือข้อมูลลูกค้า
