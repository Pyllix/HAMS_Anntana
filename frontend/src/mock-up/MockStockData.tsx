import type { AssetCategory } from "@/types/common"
import type { StockAsset } from "@/types/StockType"

export const STOCK_CATEGORIES: AssetCategory[] = [
  { code: "01", name: "ครุภัณฑ์วิทยาศาสตร์และการแพทย์" },
  { code: "02", name: "ครุภัณฑ์สำนักงาน" },
  { code: "03", name: "ครุภัณฑ์ไฟฟ้าและวิทยุ" },
  { code: "04", name: "ครุภัณฑ์งานบ้าน งานครัว" },
  { code: "05", name: "ครุภัณฑ์คอมพิวเตอร์" },
  { code: "06", name: "ครุภัณฑ์โฆษณาและเผยแพร่" },
  { code: "07", name: "ครุภัณฑ์ยานพาหนะและขนส่ง" },
]

export const STOCK_DEPARTMENTS: string[] = [
  "หอผู้ป่วยหนัก (ICU)",
  "แผนกผู้ป่วยนอก (OPD)",
  "หอผู้ป่วยศัลยกรรม (SUR)",
  "คลังพัสดุกลาง",
  "ER (ฉุกเฉิน)",
  "ฝ่ายซ่อมบำรุง",
]

export const MOCK_STOCK_ASSETS: StockAsset[] = [
  {
    id: "1",
    pid: "1234-567-89",
    name: "เครื่องช่วยหายใจ (Ventilator)",
    model: "Puritan Bennett 980",
    serialNumber: "PB980-0012",
    category: STOCK_CATEGORIES[0],
    department: "หอผู้ป่วยหนัก (ICU)",
    location: "อาคาร 1 ชั้น 3",
    status: "ใช้งานปกติ",
    purchase: {
      receivedDate: "15 ม.ค. 2567",
      company: "MedTech Supply Co., Ltd.",
      price: 450000.0,
      budgetType: "เงินบำรุงโรงพยาบาล",
    },
    warranty: {
      expireDate: "14 ม.ค. 2570",
      inWarranty: true,
      lifetimeYears: 7,
      usedDuration: "2 ปี 1 เดือน",
    },
    repairHistoryCount: 2,
    calibrationHistoryCount: 1,
  },
  {
    id: "2",
    pid: "9876-543-21",
    name: "เครื่องวัดความดันโลหิต (NIBP)",
    model: "Omron HBP-1320",
    serialNumber: "202105992",
    category: STOCK_CATEGORIES[0],
    department: "แผนกผู้ป่วยนอก (OPD)",
    location: "อาคาร 2 ชั้น 1",
    status: "สภาพชำรุด",
    purchase: {
      receivedDate: "3 มี.ค. 2565",
      company: "Omron Healthcare (Thailand)",
      price: 28500.0,
      budgetType: "เงินงบประมาณแผ่นดิน",
    },
    warranty: {
      expireDate: "2 มี.ค. 2567",
      inWarranty: false,
      lifetimeYears: 5,
      usedDuration: "4 ปี 3 เดือน",
    },
    repairHistoryCount: 5,
    calibrationHistoryCount: 3,
  },
  {
    id: "3",
    pid: "4567-890-12",
    name: "เตียงผู้ป่วยไฟฟ้า 3 ไก",
    model: "Hill-Rom 900",
    serialNumber: "HR900-884",
    category: STOCK_CATEGORIES[0],
    department: "หอผู้ป่วยศัลยกรรม (SUR)",
    location: "อาคาร 1 ชั้น 5",
    status: "รอจำหน่าย",
    purchase: {
      receivedDate: "20 มิ.ย. 2558",
      company: "Hill-Rom (Thailand) Ltd.",
      price: 185000.0,
      budgetType: "เงินบำรุงโรงพยาบาล",
    },
    warranty: {
      expireDate: "19 มิ.ย. 2561",
      inWarranty: false,
      lifetimeYears: 10,
      usedDuration: "10 ปี 11 เดือน",
    },
    repairHistoryCount: 8,
    calibrationHistoryCount: 0,
  },
  {
    id: "4",
    pid: "2345-678-90",
    name: "เครื่องควบคุมการให้สารละลาย",
    model: "Infusion Pump / Terumo TE-112",
    serialNumber: "TE112-5509",
    category: STOCK_CATEGORIES[0],
    department: "คลังพัสดุกลาง",
    location: "รอเบิกจ่าย",
    status: "ส่งคืนคลัง",
    purchase: {
      receivedDate: "8 ก.ย. 2566",
      company: "Terumo (Thailand) Co., Ltd.",
      price: 65900.0,
      budgetType: "เงินบำรุงโรงพยาบาล",
    },
    warranty: {
      expireDate: "7 ก.ย. 2569",
      inWarranty: true,
      lifetimeYears: 6,
      usedDuration: "0 ปี 9 เดือน",
    },
    repairHistoryCount: 0,
    calibrationHistoryCount: 1,
  },
]

// ใช้โชว์การ์ดสรุปบนหัวหน้า — แยกจาก array จริงเพราะของจริงมีหลักพันรายการ
// ตอนต่อ backend ค่อยเปลี่ยนมาดึงจาก API นับจำนวนจริงแทน
export const MOCK_STOCK_SUMMARY = {
  total: 1500,
  normal: 1350,
  needsAttention: 150, // สภาพชำรุด + รอจำหน่าย รวมกัน
}