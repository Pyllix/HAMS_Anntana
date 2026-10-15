import { createHash } from 'node:crypto';
import type { DemoAsset, PresentationFixture } from './fixtures';

/** Independent, repeatable choices prevent fixture loop lengths from fixing a column's value. */
export function scenarioNumber(key: string, field: string): number {
  return createHash('sha256')
    .update(`hams-variety-v1:${field}:${key}`)
    .digest()
    .readUInt32BE(0);
}

const medicalEquipment = [
  ['เครื่องติดตามสัญญาณชีพผู้ป่วย', 'PM'],
  ['เครื่องให้สารละลายทางหลอดเลือด', 'IP'],
  ['เครื่องควบคุมการให้ยาโดยกระบอกฉีดยา', 'SP'],
  ['เครื่องตรวจคลื่นไฟฟ้าหัวใจ 12 ลีด', 'ECG'],
  ['เครื่องวัดความอิ่มตัวของออกซิเจนในเลือด', 'OX'],
  ['เครื่องช่วยหายใจชนิดเคลื่อนย้าย', 'VT'],
  ['เครื่องพ่นละอองยา', 'NB'],
  ['เครื่องดูดเสมหะระบบไฟฟ้า', 'SU'],
  ['เครื่องวัดความดันโลหิตอัตโนมัติ', 'BP'],
  ['เครื่องกระตุกหัวใจไฟฟ้าชนิดไบเฟสิก', 'DF'],
  ['เครื่องควบคุมการให้อาหารทางสายยาง', 'FP'],
  ['ชุดที่นอนลมป้องกันแผลกดทับ', 'AM'],
] as const;
const computerEquipment = [
  ['เครื่องคอมพิวเตอร์ตั้งโต๊ะสำหรับงานทะเบียน', 'PC'],
  ['เครื่องคอมพิวเตอร์โน้ตบุ๊กสำหรับงานบริการ', 'NBK'],
  ['เครื่องพิมพ์เลเซอร์สำหรับเอกสารผู้ป่วย', 'PRN'],
  ['เครื่องสำรองไฟสำหรับระบบสารสนเทศ', 'UPS'],
  ['อุปกรณ์สวิตช์เครือข่ายประจำหน่วยงาน', 'SW'],
] as const;

export function variedEquipment(asset: Pick<DemoAsset, 'key' | 'type'>) {
  const catalog =
    asset.type === 'คอมพิวเตอร์และอุปกรณ์'
      ? computerEquipment
      : medicalEquipment;
  const [name, prefix] =
    catalog[scenarioNumber(asset.key, 'equipment') % catalog.length];
  const model = `${prefix}-${[1200, 2400, 3600][scenarioNumber(asset.key, 'model') % 3]}`;
  return { name, prefix, model };
}

const extensionReasons = [
  'ผู้ป่วยยังต้องติดตามอาการต่อเนื่องและยังไม่ถึงกำหนดจำหน่าย',
  'เครื่องประจำแผนกอยู่ระหว่างสอบเทียบ จึงขอใช้เครื่องสำรองต่อชั่วคราว',
  'มีผู้ป่วยรับใหม่เพิ่มขึ้นและจำเป็นต้องสำรองอุปกรณ์ในเวรกลางคืน',
  'รอส่งมอบเครื่องที่จัดซื้อใหม่ ขอใช้ครุภัณฑ์ต่อระหว่างรอรับเข้า',
  'ต้องเฝ้าระวังผู้ป่วยหลังผ่าตัดเพิ่มเติมตามแผนการรักษา',
  'ขอใช้ต่อสำหรับผู้ป่วยที่ย้ายเข้ามารักษาต่อจากหอผู้ป่วยอื่น',
  'อยู่ระหว่างประสานเครื่องทดแทนและจัดตารางรับคืนกับศูนย์ครุภัณฑ์',
  'มีภารกิจดูแลผู้ป่วยต่อเนื่องในช่วงวันหยุด จึงยังส่งคืนไม่ได้',
] as const;

/** Vary the visible fields without changing scenario IDs, workflow stages or stock. */
export function diversifyPresentation(f: PresentationFixture): void {
  const day = (offset: number) =>
    new Date(f.date.getTime() + offset * 86_400_000);
  const departmentIndex = (borrower: string) =>
    f.sections.indexOf(f.users.find((user) => user.key === borrower)!.section);
  for (const loan of f.borrows.filter((row) =>
    row.key.startsWith('volume-v2-'),
  )) {
    const index = departmentIndex(loan.borrower);
    const statusIndex = [
      'PENDING_APPROVE',
      'APPROVED',
      'BORROWED',
      'PENDING_RETURN',
      'IN_PICKUP',
      'RETURNED',
      'REJECTED',
      'CANCELLED',
    ].indexOf(loan.status);
    loan.delivery =
      (index + Math.max(0, statusIndex)) % 2 === 0 ? 'PICKUP' : 'DELIVERY';
    const offset = 2 + (scenarioNumber(loan.key, 'return-date') % 19);
    loan.expectedReturn = day(
      loan.key.endsWith('-overdue')
        ? -1 - (scenarioNumber(loan.key, 'overdue-days') % 4)
        : loan.key.endsWith('-due-soon')
          ? 1
          : loan.status === 'RETURNED'
            ? -1 - (scenarioNumber(loan.key, 'returned-deadline') % 5)
            : offset,
    );
  }
  for (const request of f.extensions.filter((row) =>
    row.key.startsWith('volume-v2-'),
  )) {
    const parent = f.borrows.find((loan) => loan.key === request.borrow)!;
    const index = departmentIndex(parent.borrower);
    const statusIndex = [
      'PENDING',
      'APPROVED',
      'REJECTED',
      'CANCELLED',
    ].indexOf(request.status);
    const currentOffset =
      1 +
      ((index * 3 + statusIndex * 2 + (request.type === 'DESK' ? 5 : 0)) % 18);
    const interval = [2, 3, 5, 7, 10, 14, 21][
      (index * 2 + statusIndex + (request.type === 'DESK' ? 3 : 0)) % 7
    ];
    request.currentDate = day(currentOffset);
    request.requestedDate = day(currentOffset + interval);
    request.reason =
      extensionReasons[
        (index * 3 + statusIndex + (request.type === 'DESK' ? 4 : 0)) %
          extensionReasons.length
      ];
    request.rejectReason =
      request.status === 'REJECTED'
        ? [
            'มีคำขอใช้เครื่องต่อจากหน่วยงานอื่น กรุณาคืนตามกำหนดเดิม',
            'ศูนย์ต้องนำเครื่องเข้าตรวจสอบความปลอดภัยตามรอบ',
            'มีเครื่องรุ่นเดียวกันพร้อมเปลี่ยนให้ใช้งาน กรุณาประสานรับเครื่องทดแทน',
          ][scenarioNumber(request.key, 'reject-reason') % 3]
        : null;
    parent.expectedReturn =
      request.status === 'APPROVED'
        ? request.requestedDate
        : request.currentDate;
  }
  for (const job of f.repairs.filter((row) =>
    row.key.startsWith('volume-v2-'),
  )) {
    const asset = f.assets.find((row) => row.key === job.asset)!;
    const { name } = variedEquipment(asset);
    const variant = scenarioNumber(job.key, 'repair-text');
    const contexts = [
      'ขณะเตรียมใช้งานประจำเวร',
      'หลังเคลื่อนย้ายระหว่างจุดบริการ',
      'ระหว่างตรวจเช็กก่อนใช้งาน',
      'หลังใช้งานต่อเนื่องหลายชั่วโมง',
      'เมื่อทดสอบกับอุปกรณ์ประกอบชุดเดิม',
      'หลังทำความสะอาดตามรอบ',
    ];
    const faults = [
      'เปิดเครื่องแล้วดับเป็นช่วง ๆ',
      'แสดงรหัสแจ้งเตือนและไม่เริ่มทำงาน',
      'ปุ่มควบคุมตอบสนองช้าและตั้งค่าไม่ได้',
      'มีเสียงผิดปกติจากชุดอุปกรณ์ภายใน',
      'หน้าจอกะพริบและอ่านค่าไม่ชัด',
      'ตรวจพบจุดเชื่อมต่อหลวมและทำงานไม่ต่อเนื่อง',
      'อุปกรณ์ประกอบชำรุดและไม่ผ่านการทดสอบก่อนใช้',
      'ไม่เก็บค่าที่ตั้งไว้หลังปิดเปิดเครื่อง',
    ];
    job.symptom = job.maintenance
      ? `${name} ถึงรอบ${['ตรวจสอบความปลอดภัยทางไฟฟ้า', 'บำรุงรักษาเชิงป้องกัน', 'ทดสอบสมรรถนะประจำปี', 'ทำความสะอาดและตรวจอุปกรณ์ประกอบ'][variant % 4]} ${contexts[scenarioNumber(job.key, 'repair-context') % contexts.length]}`
      : job.status === 'CANCELLED'
        ? `ขอยกเลิกการตรวจ ${name} เนื่องจาก${['แผนกต่ออุปกรณ์ใหม่แล้วใช้งานได้ปกติ', 'พบว่าตั้งค่าโหมดการทำงานไม่ตรงกับคู่มือ', 'แผนกตรวจสอบแล้วเป็นปัญหาที่สายต่อภายนอก'][variant % 3]}`
        : `${name} ${faults[variant % faults.length]} ${contexts[scenarioNumber(job.key, 'repair-context') % contexts.length]}`;
    if (job.track) {
      job.diagnosis = `${name}: ${['พบหน้าสัมผัสเสื่อมและค่าความต้านทานสูง', 'พบแรงดันจ่ายไม่นิ่งเมื่อทดสอบภายใต้โหลด', 'พบชุดควบคุมทำงานคลาดเคลื่อนจากค่ามาตรฐาน', 'พบขั้วต่อหลวมและสายสัญญาณมีความเสียหาย', 'พบชิ้นส่วนประกอบสึกหรอจากการใช้งานต่อเนื่อง', 'พบความชื้นและคราบสกปรกบริเวณอุปกรณ์ภายใน'][scenarioNumber(job.key, 'diagnosis') % 6]}`;
      const solutions = {
        SELF_REPAIR: [
          'ทำความสะอาดหน้าสัมผัสและปรับตั้งตามคู่มือ',
          'ซ่อมจุดเชื่อมต่อและตรวจค่าความปลอดภัยทางไฟฟ้า',
          'ปรับตั้งระบบควบคุมและทดสอบภายใต้โหลด',
        ],
        WITH_PARTS: [
          'เปลี่ยนอุปกรณ์ที่เสื่อมตามรายการเบิกและทดสอบซ้ำ',
          'เปลี่ยนชุดประกอบที่ชำรุดพร้อมตรวจสอบการเชื่อมต่อ',
          'เปลี่ยนชิ้นส่วนตามผลวินิจฉัยและตรวจรับหลังซ่อม',
        ],
        OUTSOURCE: [
          'ประสานบริษัทตรวจซ่อมและขอผลทดสอบตามมาตรฐาน',
          'ส่งศูนย์บริการตรวจชุดควบคุมและประเมินค่าใช้จ่าย',
          'ให้ผู้ให้บริการเปลี่ยนอุปกรณ์เฉพาะทางและรับประกันงานซ่อม',
        ],
        UNREPAIRABLE: [
          'จัดทำบันทึกความเสียหายและนำส่งพัสดุพิจารณาจำหน่าย',
          'ประเมินว่าซ่อมไม่คุ้มค่าและขอจัดหาเครื่องทดแทน',
          'ตรวจยืนยันความเสียหายและจัดทำเอกสารแทงชำรุด',
        ],
      };
      job.solution = `${name}: ${solutions[job.track][scenarioNumber(job.key, 'solution') % 3]}`;
    }
  }
}
