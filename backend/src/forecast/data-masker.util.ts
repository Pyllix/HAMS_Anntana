/**
 * Data Masker Utility สำหรับระบบ HAMS
 * ปฏิบัติตามมาตรฐาน PDPA: ปกปิดข้อมูลอัตลักษณ์โรงพยาบาลและแปลงชื่อแผนกเป็นรหัสนามแฝง
 * ก่อนส่งข้อมูลออกไปยังภายนอก (Google Gemini API / Nixtla TimeGPT)
 */

export interface MaskedSession {
  maskedDepartmentCode: string;
  maskedPayload: {
    unit_id: string;
    category: string;
    series: Array<{ period: string; cost: number }>;
  };
  mappingTable: Map<string, string>;
}

export class DataMasker {
  /**
   * 1. Outbound Masking: แปลงข้อมูลจริงเป็นนิรนาม
   * - ตัดชื่อโรงพยาบาลทิ้งทั้งหมด
   * - ตัดรหัสครุภัณฑ์ (asset_id) ทิ้งทั้งหมด
   * - แปลงชื่อแผนกจริงเป็นรหัสนามแฝง (เช่น DEPT_01)
   */
  static mask(
    sectionName: string,
    rawHistory: Array<{ date: string; cost: number }>,
  ): MaskedSession {
    const mappingTable = new Map<string, string>();
    const maskedCode = 'DEPT_01';
    mappingTable.set(maskedCode, sectionName || 'ทุกแผนกภาพรวม');

    const maskedPayload = {
      unit_id: maskedCode,
      category: 'Hospital_Medical_Maintenance',
      series: rawHistory.map((item) => ({
        period: item.date,
        cost: Math.round(item.cost * 100) / 100,
      })),
    };

    return {
      maskedDepartmentCode: maskedCode,
      maskedPayload,
      mappingTable,
    };
  }

  /**
   * 2. Inbound Unmasking: แปลงรหัสนามแฝงกลับมาเป็นชื่อแผนกจริง
   * เมื่อ AI ภายนอกตอบกลับบทวิเคราะห์
   */
  static unmask(aiText: string, mappingTable: Map<string, string>): string {
    if (!aiText) return '';
    let result = aiText;
    mappingTable.forEach((realName, pseudoCode) => {
      const regex = new RegExp(pseudoCode, 'g');
      result = result.replace(regex, realName);
    });
    return result;
  }
}
