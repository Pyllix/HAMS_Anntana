import { originalSections } from '../demo-identities';

// Fictional inventory labels in hospital format; keys remain private scenario identifiers.
const equipment = [
  ['เครื่องติดตามสัญญาณชีพผู้ป่วย', 'PM'],
  ['เครื่องให้สารละลายทางหลอดเลือด', 'IP'],
  ['เครื่องควบคุมการให้ยาโดยกระบอกฉีดยา', 'SP'],
  ['เครื่องตรวจคลื่นไฟฟ้าหัวใจ 12 ลีด', 'ECG'],
  ['เครื่องวัดความอิ่มตัวของออกซิเจนในเลือด', 'OX'],
  ['เครื่องช่วยหายใจชนิดเคลื่อนย้าย', 'VT'],
  ['เครื่องพ่นละอองยา', 'NB'],
  ['เครื่องดูดเสมหะระบบไฟฟ้า', 'SU'],
] as const;

export function assetLabels(
  asset: { key: string; type: string; section: string; receivedDate: Date },
  index: number,
) {
  let [name, prefix] = equipment[index % equipment.length] as readonly [
    string,
    string,
  ];
  let model = `${prefix}-${2000 + index * 10}`;
  if (asset.type === 'คอมพิวเตอร์และอุปกรณ์') {
    prefix = 'PC';
    name = 'เครื่องคอมพิวเตอร์สำหรับงานทะเบียนครุภัณฑ์';
    model = `PC-${5000 + index * 10}`;
  }
  if (asset.key.startsWith('rotation-even-')) {
    prefix = 'BP';
    name = 'เครื่องวัดความดันโลหิตอัตโนมัติ';
    model = 'BP-6200';
  } else if (asset.key.startsWith('rotation-')) {
    prefix = 'SU';
    name = 'เครื่องดูดเสมหะระบบไฟฟ้า';
    model = 'SU-7300';
  }
  const year = asset.receivedDate.getUTCFullYear() + 543;
  const number = String(index + 1).padStart(3, '0');
  const section = asset.section === 'CENTER' ? 'CEN' : asset.section;
  return {
    name,
    model,
    noid: `EQ-${year}-${section}-${number}`,
    serialNo: `${prefix}-${year}-${number}`,
    acqDoc: `ACQ-${year}-${number}`,
    remark: 'จัดสรรสำหรับงานบริการทางการแพทย์และดูแลผู้ป่วย',
  };
}
export const sectionLabels = (key: string) => ({
  ...(originalSections.find((section) => section.code === key) ?? {
    code: key,
    name: 'ฝ่ายบริหารทั่วไป',
    tel: '1001',
    building: 'อาคารบริหาร ชั้น 2',
  }),
  // Reference bootstrap already owns IT; retain a distinct ID and readable code.
  code: key === 'IT' ? 'IT-02' : key,
});
export const partLabels: Record<string, { code: string; name: string }> = {
  filter: { code: 'SP-MED-001', name: 'ไส้กรองอากาศเครื่องช่วยหายใจ' },
  sensor: { code: 'SP-MED-002', name: 'เซนเซอร์วัดออกซิเจน' },
  'battery-low': {
    code: 'SP-MED-003',
    name: 'แบตเตอรี่สำรองเครื่องติดตามสัญญาณชีพ',
  },
  'motor-empty': { code: 'SP-MED-004', name: 'มอเตอร์ปั๊มเครื่องดูดเสมหะ' },
  'cable-threshold': {
    code: 'SP-MED-005',
    name: 'สายสัญญาณตรวจคลื่นไฟฟ้าหัวใจ',
  },
};
export const supplementalUsers: Record<
  string,
  { userName: string; firstname: string; lastname: string; email: string }
> = {
  'account-edit': {
    userName: 'deptstaff_icu3',
    firstname: 'สิริพร',
    lastname: 'สุขสวัสดิ์',
    email: 'icu3@hospital.go.th',
  },
  'account-unverified': {
    userName: 'deptstaff_er3',
    firstname: 'ณัฐพล',
    lastname: 'ใจดี',
    email: 'er3@hospital.go.th',
  },
  'account-restore': {
    userName: 'deptstaff_er4',
    firstname: 'ปาริชาติ',
    lastname: 'ศรีสุข',
    email: 'er4@hospital.go.th',
  },
};
export const inventoryLabels = {
  vendor: {
    code: 'COMP005',
    name: 'บริษัท เมดิคอลเซอร์วิส แอนด์ ซัพพลาย จำกัด',
    email: 'service@medical-supply.example',
    group: 'MAINTENANCE',
  },
  restoreVendor: { code: 'COMP006', name: 'บริษัท เฮลท์แคร์เทคโนโลยี จำกัด' },
  restoreSection: {
    code: 'CSSD',
    name: 'แผนกเวชภัณฑ์กลาง',
    tel: '1700',
    building: 'อาคารสนับสนุนทางการแพทย์ ชั้น 1',
  },
  group: 'อะไหล่เครื่องมือแพทย์',
  restoreAcquisition: 'รับโอนจากหน่วยงานภาครัฐ',
  budget: 'งบพัฒนาเครื่องมือแพทย์',
  inactiveBudget: 'งบปรับปรุงอุปกรณ์ทางการแพทย์',
};
export const documentLabel = (kind: string, date: Date, index: number) =>
  `${kind}-${date.getUTCFullYear() + 543}-${String(index + 1).padStart(4, '0')}`;
export const repairLabels = (track: string | null, maintenance: boolean) => ({
  symptom: maintenance
    ? 'ตรวจเช็กและบำรุงรักษาตามรอบที่กำหนด'
    : 'เครื่องทำงานผิดปกติ มีสัญญาณแจ้งเตือนขณะใช้งาน',
  diagnosis: track ? 'ตรวจพบความผิดปกติของระบบควบคุมและอุปกรณ์ประกอบ' : null,
  solution:
    track === 'SELF_REPAIR'
      ? 'ตรวจปรับและซ่อมแซมโดยช่างโรงพยาบาล'
      : track === 'WITH_PARTS'
        ? 'เปลี่ยนอะไหล่และทดสอบการทำงานหลังซ่อม'
        : track === 'OUTSOURCE'
          ? 'ส่งบริษัทผู้ให้บริการซ่อมและตรวจสอบมาตรฐาน'
          : track === 'UNREPAIRABLE'
            ? 'ประเมินความเสียหายและนำส่งพัสดุเพื่อพิจารณาจำหน่าย'
            : null,
});
