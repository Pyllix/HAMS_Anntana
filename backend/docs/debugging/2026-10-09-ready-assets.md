# รายการครุภัณฑ์พร้อมยืมว่างหลัง presentation seed

สาเหตุหลักคือ section ของศูนย์ใน presentation seed ใช้ code `PRESENT-CENTER` ขณะที่ `AvailableAssetsTable` หา `CENTER` ก่อนเปิด query และ `AssetBorrowService.createBorrow` อนุญาตเฉพาะ `CENTER` จึงไม่แสดงข้อมูลและขอยืมไม่ได้ แม้สถานะเครื่องถูกต้อง FK ไม่ได้เสีย

ก่อนแก้: ฐาน hams_db_test มีเครื่อง NORMAL/AVAILABLE ใน PRESENT-CENTER 12 เครื่อง แต่ frontend callback หา CENTER ไม่พบและรายการพร้อมยืมเป็น 0

แก้ฐานโดยเปลี่ยนเฉพาะ code/name ของ section เดิม เป็น CENTER/ชื่อศูนย์เดิม โดยคง section ID `3cda6167-49dd-483e-aab8-dac0b7daba0d` ไว้ ข้อมูลผู้ใช้ accounts เครื่อง ใบยืม extensions งานซ่อม steps assignments อะไหล่/ledger โอนและจำหน่ายเทียบ checksum ก่อน–หลังแล้วเหมือนเดิม ปรับ mapper ของ seed และ checker ให้ป้องกันสาเหตุนี้ในครั้งต่อไป

พบปัญหาร่วมด้วยว่า frontend `getAssets` ขอเพียงหน้าแรก (20 รายการ) แล้ว `AvailableAssetsTable` กรองสถานะใน browser ทำให้หลังแก้ CENTER เห็นพร้อมยืมเพียง 7 จาก 12 เครื่อง ปรับบริการ array นี้ให้ดึงทุกหน้าด้วย limit 100 ตามเพดาน backend ก่อนคืนข้อมูลให้ caller เดิม

หลักฐานการตรวจ:

- Regression ของ seed ล้มเหลวก่อนแก้เมื่อหา CENTER ไม่พบ และผ่านหลังแก้; ชุด presentation รวม 12 tests ผ่าน
- Regression ของ frontend วางเครื่องพร้อมยืม 12 เครื่องไว้หลัง 100 เครื่องที่ไม่พร้อมให้ยืม เดิมคืนรายการพร้อมยืม 0 หลังแก้คืนครบ 12; รวม 2 tests ผ่าน
- ใช้ callback `centerSectionId` และ `filteredAssets` จากไฟล์ frontend จริง ร่วมกับ `getAssets` จริงและ `AssetService.findAll` ที่ต่อ hams_db_test ผลเป็น CENTER found และ visibleReadyAssets = 12 โดยจำลองเพียงขอบเขต HTTP ไม่ได้เปิด browser
- เรียก `AssetBorrowService.createBorrow` จริงสำหรับ live-start ด้วยผู้ใช้ ICU ใน transaction แล้ว rollback ผลเป็น PENDING_APPROVE; ไม่มีรายการทดลองค้างหรือสถานะเครื่องเปลี่ยน
- Backend typecheck/ESLint และ frontend test typecheck/build ผ่าน

สคริปต์ตรวจซ้ำอยู่ในพื้นที่ debug ที่ไม่ commit: `.temp/debug/ready-assets.ts` เรียกผ่าน `node .temp/prepare-presentation-test.cjs repro-ready` โดย wrapper เลือก hams_db_test อย่างชัดเจนและไม่พิมพ์ข้อมูลเชื่อมต่อลับ

การออกแบบ seed ควรแยก namespace ของข้อมูลทดลองจาก code ที่ business logic ใช้จริง: CENTER เป็น code ที่มีความหมายในระบบ จึงต้องรักษาไว้ แม้ record และ UUID เป็นของชุดนำเสนอ
