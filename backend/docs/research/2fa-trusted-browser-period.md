# ระยะเวลา Trusted Browser สำหรับ 2FA ของ HAMS

วันที่ค้นคว้า: 19 กันยายน 2569 (2026-09-19)

## คำตอบสั้น

**30 วันไม่ใช่ระยะเวลาที่กฎหมายไทยกำหนดให้ Trusted Browser ต้องใช้ และไม่ใช่ค่ามาตรฐานความปลอดภัยสากลสำหรับการข้าม TOTP** ตัวเลข 30 วันที่พบใน BetterAuth เป็นค่าเริ่มต้นของปลั๊กอิน ซึ่งปรับได้ด้วย `trustDeviceMaxAge`; เอกสาร BetterAuth ระบุด้วยว่าระยะนี้ถูกต่ออายุใหม่ทุกครั้งที่ลงชื่อเข้าสำเร็จ จึงเป็นอายุแบบเลื่อนต่อ (sliding) ไม่ใช่เพดานตายตัว 30 วัน ([BetterAuth 2FA documentation](https://better-auth.com/docs/plugins/2fa), [BetterAuth option/source definition](https://github.com/better-auth/better-auth/blob/main/packages/better-auth/src/plugins/two-factor/types.ts), [BetterAuth default constant](https://github.com/better-auth/better-auth/blob/main/packages/better-auth/src/plugins/two-factor/constant.ts)).

ตัวเลข 30 วันในมาตรฐานไทยที่หาได้หมายถึง **การยืนยันตัวตนซ้ำหรืออายุเซสชันระดับ AAL1** ซึ่งเป็นการยืนยันแบบปัจจัยเดียวขั้นต่ำ ไม่ได้หมายถึงการจำ Browser เพื่อข้ามปัจจัยที่สอง สำหรับ AAL2 ในมาตรฐานรัฐบาลดิจิทัลฉบับเดียวกัน ระบุ 12 ชั่วโมง หรือ 30 นาทีเมื่อไม่มีกิจกรรม ([มรด. 1-2:2564, หน้าเอกสาร 25 และ 31–32](https://standard.dga.or.th/wp-content/uploads/2021/09/3.Digital-ID-DGS-1-2_2564.pdf)).

## ต้องแยกสามเรื่องออกจากกัน

| เรื่อง | ความหมาย | ผลเมื่อหมดอายุ |
|---|---|---|
| Session lifetime | ระยะที่ Session ปัจจุบันยังใช้งานได้หลังยืนยันตัวตน | ต้องยืนยันตัวตนใหม่เพื่อเริ่ม Session ใหม่ |
| Reauthentication interval | ระยะที่ต้องพิสูจน์ว่าผู้ใช้คนเดิมยังอยู่และตั้งใจใช้งานต่อ | อาจให้กรอกปัจจัยเดียวหรือทุกปัจจัยตามระดับความเสี่ยง |
| Trusted-browser bypass | Credential แยกต่างหากใน Browser ที่ทำให้การลงชื่อเข้าครั้งใหม่ไม่ต้องกรอก TOTP | เมื่อหมดอายุจึงขอ TOTP อีกครั้ง |

มาตรฐานรัฐบาลดิจิทัลนิยามช่วง 30 วัน/12 ชั่วโมงไว้ในส่วนการบริหาร Session และการยืนยันตัวตนซ้ำ ส่วน BetterAuth สร้าง Trusted-device cookie และข้อมูลฝั่ง Server แยกจาก Session ดังนั้นห้ามนำตัวเลขของเรื่องหนึ่งไปอ้างว่าเป็นข้อบังคับของอีกเรื่องหนึ่ง ([มรด. 1-2:2564, หัวข้อ 3.4](https://standard.dga.or.th/wp-content/uploads/2021/09/3.Digital-ID-DGS-1-2_2564.pdf), [BetterAuth 2FA documentation](https://better-auth.com/docs/plugins/2fa)).

## สิ่งที่ข้อกำหนดไทยบอกจริง

### 1. กฎหมายคุ้มครองข้อมูลส่วนบุคคล

ประกาศคณะกรรมการคุ้มครองข้อมูลส่วนบุคคลกำหนดให้มีมาตรการเชิงองค์กร เทคนิค และกายภาพที่เหมาะสมกับระดับความเสี่ยง รวมถึง Access Control, Identity Proofing and Authentication, Authorization, User Access Management และหลัก least privilege แต่ไม่ได้กำหนดว่า Trusted Browser ต้องมีอายุ 30 วัน ([ราชกิจจานุเบกษา เล่ม 139 ตอนพิเศษ 140 ง, 20 มิถุนายน 2565](https://www.ratchakitcha.soc.go.th/DATA/PDF/2565/E/140/T_0028.PDF)).

ดังนั้น PDPA สนับสนุนการเลือกระยะเวลาจากการประเมินความเสี่ยง ไม่ได้ให้ตัวเลข 30 วันเป็น safe harbor โดยอัตโนมัติ ([ราชกิจจานุเบกษาฉบับเดียวกัน](https://www.ratchakitcha.soc.go.th/DATA/PDF/2565/E/140/T_0028.PDF)).

### 2. มาตรฐานรัฐบาลดิจิทัล มรด. 1-2:2564

มาตรฐานนี้ประกาศในราชกิจจานุเบกษาและมุ่งที่ระบบให้บริการภาครัฐแก่บุคคลธรรมดาสัญชาติไทย โดยแบ่งระดับตามความเสี่ยงของบริการ ([หน้าประกาศของ DGA](https://standard.dga.or.th/news/3728/)).

- AAL1: Session หมดอายุ 30 วัน และตารางสรุประบุให้ยืนยันตัวตนซ้ำอย่างน้อยทุก 30 วัน
- AAL2: Session หมดอายุ 12 ชั่วโมง หรือเมื่อไม่มีกิจกรรม 30 นาที; การยืนยันซ้ำอาจใช้หนึ่งปัจจัยได้
- AAL3: Session หมดอายุ 12 ชั่วโมง หรือเมื่อไม่มีกิจกรรม 15 นาที; การยืนยันซ้ำต้องใช้ทุกปัจจัย

รายละเอียดข้างต้นอยู่ในหัวข้อ Session Management และตารางกำหนดระดับ AAL ไม่ใช่หัวข้อ Trusted Device ([มรด. 1-2:2564, หน้าเอกสาร 25–26 และ 30–33](https://standard.dga.or.th/wp-content/uploads/2021/09/3.Digital-ID-DGS-1-2_2564.pdf)).

HAMS เป็นระบบบริหารครุภัณฑ์ภายในโรงพยาบาลสำหรับเจ้าหน้าที่ ไม่ใช่บริการประชาชนตามคำอธิบายขอบเขตของ DGA อย่างชัดเจน จึงยังสรุปไม่ได้จากเอกสารเพียงอย่างเดียวว่าข้อกำหนดนี้บังคับ HAMS โดยตรง ควรให้ฝ่ายกฎหมาย/กำกับดูแลของโรงพยาบาลยืนยันสถานะหน่วยงานและขอบเขตบริการก่อนอ้างว่าเป็นข้อบังคับ ([หน้าประกาศของ DGA](https://standard.dga.or.th/news/3728/)).

### 3. มาตรฐาน ETDA ปัจจุบันด้านการยืนยันตัวตน

มธอ. 11 เล่ม 3-2566 กำหนด AAL2 ให้ใช้สองปัจจัยที่แตกต่างกัน และระบุว่ามาตรฐานมุ่งผู้ให้บริการพิสูจน์และยืนยันตัวตนแก่บุคคลภายนอก แต่สามารถประยุกต์กับบริการภายในกิจการได้ มาตรฐานฉบับนี้ไม่กำหนดตัวเลข 30 วันสำหรับ Trusted Browser หรือรอบ Reauthentication ([มธอ. 11 เล่ม 3-2566, ขอบข่ายและ AAL2](https://www.etda.or.th/getattachment/Regulator/DigitalID/law/ETS-DID-Part3-Authentication_V01-22F.pdf.aspx?lang=th-TH), [หน้ารวมกฎหมาย/มาตรฐาน Digital ID ของ ETDA](https://www.etda.or.th/th/regulator/DigitalID/law.aspx)).

## ตัวเลข 30 วันของ BetterAuth มาจากไหน

HAMS ติดตั้ง `better-auth` 1.6.16 และยังไม่ได้เปิดปลั๊กอิน 2FA หรือกำหนด Session lifetime เองใน `src/auth/auth.ts`.

BetterAuth กำหนด `TRUST_DEVICE_COOKIE_MAX_AGE = 30 * 24 * 60 * 60` และเปิดให้เปลี่ยนผ่าน `trustDeviceMaxAge`; เอกสารระบุว่าเมื่อ `trustDevice: true` Browser จะข้าม 2FA ในการลงชื่อเข้าครั้งถัดไปภายในช่วงดังกล่าว และระยะจะถูก refresh ทุกครั้งที่ลงชื่อเข้าสำเร็จ ([BetterAuth source: constant](https://github.com/better-auth/better-auth/blob/main/packages/better-auth/src/plugins/two-factor/constant.ts), [BetterAuth source: option](https://github.com/better-auth/better-auth/blob/main/packages/better-auth/src/plugins/two-factor/types.ts), [BetterAuth 2FA documentation](https://better-auth.com/docs/plugins/2fa)).

นี่เป็น **product default** ที่ผู้พัฒนาไลบรารีเลือก ไม่พบข้อความในเอกสารหรือ source ที่อ้างว่า 30 วันมาจากกฎหมายไทย, NIST หรือมาตรฐานด้านโรงพยาบาล ([BetterAuth 2FA documentation](https://better-auth.com/docs/plugins/2fa), [BetterAuth source: constant](https://github.com/better-auth/better-auth/blob/main/packages/better-auth/src/plugins/two-factor/constant.ts)).

อีกประเด็นหนึ่งคือ Session ปกติของ BetterAuth แยกจาก Trusted Device: Session มีค่าเริ่มต้น 7 วันและต่ออายุเมื่อถึง `updateAge` ซึ่งต่างจาก Trusted-device bypass ([BetterAuth Session Management](https://better-auth.com/docs/concepts/session-management)).

## เปรียบเทียบกับ NIST (ไม่ใช่กฎหมายไทย)

NIST SP 800-63B-4 ระบุ 30 วันเป็นค่าแนะนำของ overall reauthentication timeout ที่ AAL1 ส่วน AAL2 แนะนำไม่เกิน 24 ชั่วโมงและ inactivity ไม่เกิน 1 ชั่วโมง; NIST แยก Session/Reauthentication จากปัจจัยที่ใช้ยืนยันตัวตนเช่นกัน ([NIST SP 800-63B-4: Authentication Assurance Levels](https://pages.nist.gov/800-63-4/sp800-63b/aal/)).

NIST ใช้กับระบบรัฐบาลกลางสหรัฐและใช้ได้เพียงแหล่งเปรียบเทียบเชิงเทคนิคสำหรับ HAMS ไม่ใช่ข้อบังคับทางกฎหมายของไทย ([NIST SP 800-63-4](https://pages.nist.gov/800-63-4/sp800-63.html)).

## ข้อเสนอสำหรับ HAMS

1. **อย่าใช้คำว่า “30 วันตามมาตรฐานรัฐ”** เพราะไม่ตรงกับแหล่งอ้างอิง ควรบันทึกว่าเป็นค่าที่โรงพยาบาลเลือกจากการประเมินความเสี่ยงและรับรองโดยผู้รับผิดชอบด้าน IT/PDPA.
2. **เริ่มด้วย Trusted Browser 14 วันแบบอายุแน่นอน (absolute)** เฉพาะเครื่องประจำบุคคลหรือเครื่องที่โรงพยาบาลบริหารจัดการ ผู้ใช้ต้องเลือกเองและช่องเลือกต้องไม่ถูกติ๊กไว้ล่วงหน้า. ตัวเลข 14 วันเป็นข้อเสนอเชิงผลิตภัณฑ์เพื่อให้กรอก TOTP ประมาณเดือนละสองครั้ง ไม่ใช่ตัวเลขจากกฎหมาย.
3. **ห้าม Trusted Browser บนเครื่องส่วนกลาง/เครื่องใช้ร่วมกัน** และแสดงข้อความชัดเจนว่าไม่ให้เลือกบนเครื่องดังกล่าว เพราะ cookie พิสูจน์ได้เพียงว่ามี token อยู่ใน Browser ไม่ได้พิสูจน์ว่าเจ้าของบัญชีเป็นผู้ใช้งานเครื่องในขณะนั้น.
4. **อย่าใช้พฤติกรรม sliding 30 วันของ BetterAuth โดยไม่ตั้งใจ** หากต้องการเพดาน 14 วันจริง ต้องเก็บ `trustedAt`/`absoluteExpiresAt` ฝั่ง Server หรือปรับ flow ไม่ให้การลงชื่อเข้าทุกครั้งต่ออายุได้ไม่สิ้นสุด; `trustDeviceMaxAge: 14 * 24 * 60 * 60` อย่างเดียวจะยังเป็น sliding ตามพฤติกรรมเอกสาร BetterAuth ([BetterAuth 2FA documentation](https://better-auth.com/docs/plugins/2fa)).
5. **กำหนด Session แยกต่างหาก** เช่น overall 12 ชั่วโมงและ inactivity 30 นาทีสำหรับสาม Role ที่บังคับ 2FA โดยไม่ตีความว่า Trusted Browser ต้องหมดพร้อม Session. ค่านี้สอดคล้องกับ AAL2 ของ มรด. 1-2:2564 ในฐานะ benchmark แต่การใช้กับ HAMS โดยตรงต้องยืนยันขอบเขตกับฝ่ายกำกับดูแล ([มรด. 1-2:2564](https://standard.dga.or.th/wp-content/uploads/2021/09/3.Digital-ID-DGS-1-2_2564.pdf)).
6. **บังคับ TOTP ใหม่เมื่อมีเหตุเสี่ยง** ได้แก่ Browser/อุปกรณ์ใหม่, ล้าง cookie, Trusted token หมดอายุ, รีเซ็ตรหัสผ่าน, รีเซ็ต/เปลี่ยน 2FA, เปลี่ยน Role, Admin revoke, หรือพบพฤติกรรมผิดปกติ; ให้ผู้ใช้ดูและเพิกถอน Browser ที่เชื่อถือได้เองได้.
7. **ใช้ Step-up Authentication กับงานผลกระทบสูง** เช่น รีเซ็ต 2FA ให้ผู้อื่น, เปลี่ยน Role/สิทธิ, ปิดบัญชี Admin, และเปลี่ยนค่าความปลอดภัย แม้ Browser ยัง Trusted อยู่.
8. **ทางลดภาระในระยะถัดไป** คือเพิ่ม Passkey/WebAuthn สำหรับเครื่องหรือโทรศัพท์ประจำบุคคล การแตะ biometric/PIN บนอุปกรณ์ทำได้เร็วกว่าเปิดแอปแล้วพิมพ์ TOTP และ NIST แนะนำให้มีตัวเลือกที่ต้าน phishing ที่ AAL2 ([NIST SP 800-63B-4: AAL2](https://pages.nist.gov/800-63-4/sp800-63b/aal/)).

## มติที่ควรขอจากเจ้าของระบบต่อ

ให้เลือกระหว่างสองนโยบาย โดยไม่อ้างว่าแบบใดเป็น “ข้อบังคับ 30 วัน”:

- **สมดุล (แนะนำ):** Trusted Browser 14 วันแบบ absolute เฉพาะเครื่องประจำบุคคล + Session 12 ชั่วโมง/idle 30 นาที + Step-up สำหรับงานผลกระทบสูง
- **เข้มงวด:** ไม่ให้ Trusted Browser หรือให้ 7 วันแบบ absolute + Session 12 ชั่วโมง/idle 30 นาที

ก่อนใช้งานจริง ให้ฝ่าย IT Security/DPO ของโรงพยาบาลยืนยันว่าเครื่องของสาม Role เป็นเครื่องประจำหรือเครื่องร่วม และ HAMS อยู่ภายใต้นโยบายกระทรวง/โรงพยาบาลฉบับใดเพิ่มเติม เพราะข้อเท็จจริงสองข้อนี้เปลี่ยนคำตอบด้านความเสี่ยงอย่างมีนัยสำคัญ.
