import type {
  MaintenanceJobPrintRequest,
  MaintenancePeriodPrintRequest,
} from "../types/TypeMaintenanceReport";
import type {
  RepairActionType,
  RepairJob,
  RepairJobStatusCode,
  RepairSparePartTransaction,
  RepairUser,
} from "../types/TypeRepairWorkflow";

const actionLabels: Record<RepairActionType, string> = {
  SELF_REPAIR: "ซ่อมเองได้",
  WITH_PARTS: "ขอเบิกอะไหล่",
  INTERNAL_STOCK: "เบิกอะไหล่ภายใน",
  EXTERNAL_STOCK: "จัดหาอะไหล่ภายนอก",
  OUTSOURCE: "ส่งซ่อมภายนอก",
  UNREPAIRABLE: "ไม่สามารถซ่อมได้",
};

const statusLabels: Record<RepairJobStatusCode, string> = {
  WAITING_HANDOVER: "รอรับเครื่อง",
  PENDING_ASSIGN: "รอมอบหมายงาน",
  IN_PROGRESS: "กำลังดำเนินการ",
  WAITING_PARTS: "รออะไหล่",
  PARCEL_PROCESSING: "พัสดุกำลังดำเนินการ",
  OUTSOURCED: "ส่งซ่อมบริษัทภายนอก",
  UNREPAIRABLE: "ไม่สามารถซ่อมได้",
  WAITING_DELIVERY: "เสร็จแล้วรอรับคืน",
  COMPLETED: "ปิดงานแล้ว",
  CANCELLED: "ยกเลิก",
};

function escapeHtml(value: unknown): string {
  return String(value ?? "-")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value?: string | Date | null, includeTime = false): string {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "long",
    year: "numeric",
    ...(includeTime
      ? ({ hour: "2-digit", minute: "2-digit" } as const)
      : {}),
  }).format(date);
}

function money(value?: number | null): string {
  return Number(value || 0).toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function personName(user?: RepairUser | null): string {
  if (!user) return "-";
  return `${user.firstName} ${user.lastName}`.trim() || "-";
}

function mechanicNames(job: RepairJob): string {
  const names = (job.mechanics || [])
    .map((mechanic) => personName(mechanic.user))
    .filter((name) => name !== "-");
  return names.length ? names.join(", ") : personName(job.evaluator);
}

function getRequestedParts(job: RepairJob): RepairSparePartTransaction[] {
  return (job.sparePartTransactions || []).filter(
    (part) =>
      part.transactionType === "PENDING_WITHDRAW" ||
      part.transactionType === "WITHDRAW",
  );
}

function field(label: string, value: unknown, wide = false): string {
  return `<div class="field ${wide ? "wide" : ""}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function signature(label: string, name = ""): string {
  return `<div class="signature"><div class="sign-line"></div><strong>${escapeHtml(label)}</strong><span>${escapeHtml(name || "ลงชื่อ")}</span><span>วันที่ ______ / ______ / ______</span></div>`;
}

function commonHeader(title: string, reference: string): string {
  return `<header class="document-header">
    <div class="brand-mark">H</div>
    <div class="brand-copy">
      <p>ระบบบริหารจัดการครุภัณฑ์ (HAMS)</p>
      <h1>${escapeHtml(title)}</h1>
      <span>หน่วยงานซ่อมบำรุง</span>
    </div>
    <div class="document-ref"><span>เลขที่เอกสาร</span><strong>${escapeHtml(reference)}</strong></div>
  </header>`;
}

function jobOverview(job: RepairJob): string {
  const urgency =
    job.urgencyStatus === "EMERGENCY"
      ? "ด่วนมาก"
      : job.urgencyStatus === "URGENT"
        ? "ด่วน"
        : "ปกติ";
  return `<section>
    <h2>ข้อมูลใบงานและครุภัณฑ์</h2>
    <div class="field-grid">
      ${field("เลขที่ใบงาน", job.jobNo)}
      ${field("วันที่แจ้งซ่อม", formatDate(job.createdAt, true))}
      ${field("รหัสครุภัณฑ์", job.asset?.assetCode)}
      ${field("ชื่อครุภัณฑ์", job.asset?.assetName)}
      ${field("รุ่น", job.asset?.model)}
      ${field("หมายเลขเครื่อง", job.asset?.serialNumber)}
      ${field("หน่วยงานผู้แจ้ง", job.section?.sectionName || job.asset?.location)}
      ${field("ผู้แจ้งซ่อม", personName(job.reporter))}
      ${field("ระดับความเร่งด่วน", urgency)}
      ${field("สถานะ", job.status ? statusLabels[job.status.statusCode] : "-")}
      ${field("อาการที่แจ้ง", job.symptom, true)}
    </div>
  </section>`;
}

function partsTable(parts: RepairSparePartTransaction[]): string {
  const rows = parts.length
    ? parts
        .map(
          (part, index) => `<tr>
            <td class="center">${index + 1}</td>
            <td><strong>${escapeHtml(part.sparePartName)}</strong><small>${escapeHtml(part.sparePartCode)}</small></td>
            <td class="center">${escapeHtml(part.stockType === "EXTERNAL" ? "จัดหาภายนอก" : "ในคลัง")}</td>
            <td class="number">${escapeHtml(part.quantity)}</td>
            <td class="number">${money(part.unitPrice)}</td>
            <td class="number">${money(part.quantity * part.unitPrice)}</td>
          </tr>`,
        )
        .join("")
    : `<tr><td colspan="6" class="empty">ไม่มีรายการอะไหล่ในใบงานนี้</td></tr>`;
  const total = parts.reduce(
    (sum, part) => sum + part.quantity * part.unitPrice,
    0,
  );
  return `<table>
    <thead><tr><th class="center">ลำดับ</th><th>รายการอะไหล่</th><th class="center">แหล่งอะไหล่</th><th class="number">จำนวน</th><th class="number">ราคา/หน่วย</th><th class="number">รวม (บาท)</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td colspan="5" class="number"><strong>รวมมูลค่าอะไหล่</strong></td><td class="number"><strong>${money(total)}</strong></td></tr></tfoot>
  </table>`;
}

function workOrderBody(job: RepairJob): string {
  return `${commonHeader("ใบงานซ่อมครุภัณฑ์", job.jobNo)}
    ${jobOverview(job)}
    <section>
      <h2>การตรวจสอบและแผนดำเนินงาน</h2>
      <div class="field-grid">
        ${field("ช่างผู้รับผิดชอบ", mechanicNames(job), true)}
        ${field("วันที่ประเมิน", formatDate(job.evaluatedAt, true))}
        ${field("กำหนดแล้วเสร็จ", formatDate(job.dueDate))}
        ${field("ผลการประเมิน", job.actionType ? actionLabels[job.actionType] : "รอประเมิน")}
        ${field("สาเหตุ", job.cause?.causeName)}
        ${field("รายละเอียดการวินิจฉัย", job.diagnosis, true)}
        ${field("แนวทางแก้ไข", job.solution, true)}
      </div>
    </section>
    <div class="signatures">${signature("ผู้แจ้งซ่อม", personName(job.reporter))}${signature("ช่างผู้รับผิดชอบ", mechanicNames(job))}${signature("ผู้ตรวจสอบ")}</div>`;
}

function partsRequestBody(job: RepairJob): string {
  const parts = getRequestedParts(job);
  return `${commonHeader("ใบขอเบิกอะไหล่สำหรับงานซ่อม", `${job.jobNo}-SP`)}
    ${jobOverview(job)}
    <section><h2>รายการอะไหล่ที่ขอเบิก</h2>${partsTable(parts)}</section>
    <section class="note"><strong>เหตุผล/รายละเอียดการใช้งาน</strong><p>${escapeHtml(job.diagnosis || job.solution || job.symptom)}</p></section>
    <div class="signatures">${signature("ผู้ขอเบิก", mechanicNames(job))}${signature("ผู้จ่ายอะไหล่")}${signature("ผู้อนุมัติ")}</div>`;
}

function repairSummaryBody(job: RepairJob): string {
  const parts = getRequestedParts(job);
  const partsCost = parts.reduce(
    (sum, part) => sum + part.quantity * part.unitPrice,
    0,
  );
  const outsourceCost = Number(job.repairCost || 0);
  return `${commonHeader("ใบสรุปผลการซ่อมครุภัณฑ์", `${job.jobNo}-SUM`)}
    ${jobOverview(job)}
    <section>
      <h2>สรุปการดำเนินงาน</h2>
      <div class="field-grid">
        ${field("ผู้ประเมิน", personName(job.evaluator))}
        ${field("ช่างผู้รับผิดชอบ", mechanicNames(job))}
        ${field("ผลการประเมิน", job.actionType ? actionLabels[job.actionType] : "-")}
        ${field("วันที่ส่งมอบ/ปิดงาน", formatDate(job.confirmation?.completedDate || job.returnDate))}
        ${field("รายละเอียดการวินิจฉัย", job.diagnosis, true)}
        ${field("วิธีแก้ไข/ผลการดำเนินงาน", job.confirmation?.repairSummary || job.solution, true)}
        ${field("เหตุผลที่ไม่สามารถซ่อมได้", job.unrepairableReason, true)}
        ${field("บริษัทผู้รับซ่อม", job.company?.name)}
        ${field("เลขที่เอกสารอ้างอิง", job.billNo)}
        ${field("ผู้รับมอบ", job.confirmation?.receiverName || personName(job.reporter))}
        ${field("รับประกันถึง", formatDate(job.confirmation?.warrantyEndDate))}
      </div>
    </section>
    ${parts.length ? `<section><h2>อะไหล่ที่ใช้</h2>${partsTable(parts)}</section>` : ""}
    <section><h2>สรุปค่าใช้จ่าย</h2><div class="cost-grid">
      <div><span>ค่าอะไหล่</span><strong>${money(partsCost)} บาท</strong></div>
      <div><span>ค่าซ่อมภายนอก</span><strong>${money(outsourceCost)} บาท</strong></div>
      <div class="total"><span>ค่าใช้จ่ายรวม</span><strong>${money(partsCost + outsourceCost)} บาท</strong></div>
    </div></section>
    <div class="signatures">${signature("ช่างผู้สรุป", mechanicNames(job))}${signature("ผู้รับมอบ", job.confirmation?.receiverName)}${signature("ผู้ตรวจสอบ")}</div>`;
}

function periodReportBody(request: MaintenancePeriodPrintRequest): string {
  const { jobs, period } = request;
  const completed = jobs.filter(
    (job) => job.status?.statusCode === "COMPLETED",
  ).length;
  const open = jobs.filter(
    (job) =>
      job.status?.statusCode !== "COMPLETED" &&
      job.status?.statusCode !== "CANCELLED",
  ).length;
  const partsJobs = jobs.filter((job) => getRequestedParts(job).length).length;
  const totalCost = jobs.reduce((sum, job) => {
    const partsCost = getRequestedParts(job).reduce(
      (partSum, part) => partSum + part.quantity * part.unitPrice,
      0,
    );
    return sum + partsCost + Number(job.repairCost || 0);
  }, 0);
  const rows = jobs.length
    ? jobs
        .map(
          (job, index) => `<tr>
            <td class="center">${index + 1}</td>
            <td><strong>${escapeHtml(job.jobNo)}</strong><small>${escapeHtml(formatDate(job.createdAt))}</small></td>
            <td><strong>${escapeHtml(job.asset?.assetName)}</strong><small>${escapeHtml(job.asset?.assetCode)}</small></td>
            <td>${escapeHtml(job.section?.sectionName || "-")}</td>
            <td>${escapeHtml(mechanicNames(job))}</td>
            <td>${escapeHtml(job.actionType ? actionLabels[job.actionType] : "รอประเมิน")}</td>
            <td>${escapeHtml(job.status ? statusLabels[job.status.statusCode] : "-")}</td>
          </tr>`,
        )
        .join("")
    : `<tr><td colspan="7" class="empty">ไม่พบงานซ่อมในช่วงเวลาที่เลือก</td></tr>`;

  return `${commonHeader(
    period.mode === "DAY" ? "รายงานงานซ่อมประจำวัน" : "รายงานงานซ่อมประจำเดือน",
    `RPT-${period.value}`,
  )}
    <section class="period-title"><span>ช่วงเวลารายงาน</span><strong>${escapeHtml(period.label)}</strong></section>
    <div class="summary-grid">
      <div><span>งานทั้งหมด</span><strong>${jobs.length}</strong><small>งาน</small></div>
      <div><span>อยู่ระหว่างดำเนินการ</span><strong>${open}</strong><small>งาน</small></div>
      <div><span>ปิดงานแล้ว</span><strong>${completed}</strong><small>งาน</small></div>
      <div><span>งานที่ใช้อะไหล่</span><strong>${partsJobs}</strong><small>งาน</small></div>
    </div>
    <section><h2>รายการงานซ่อมที่รับเข้า</h2><table>
      <thead><tr><th class="center">ลำดับ</th><th>ใบงาน/วันที่แจ้ง</th><th>ครุภัณฑ์</th><th>หน่วยงาน</th><th>ช่าง</th><th>ผลประเมิน</th><th>สถานะ</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></section>
    <section class="report-total"><span>ค่าใช้จ่ายรวมตามข้อมูลในระบบ</span><strong>${money(totalCost)} บาท</strong></section>
    <div class="signatures">${signature("ผู้จัดทำ", request.context.preparedBy)}${signature("หัวหน้าหน่วยซ่อมบำรุง")}</div>`;
}

function documentShell(
  title: string,
  body: string,
  preparedBy: string,
  preparedAt: Date,
): string {
  return `<!doctype html><html lang="th"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title>
  <style>
    @font-face {
      font-family: "Noto Sans Thai";
      src: url("/fonts/NotoSansThai-Variable.ttf") format("truetype");
      font-style: normal;
      font-weight: 100 900;
      font-display: swap;
    }
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #172033; font-family: "Noto Sans Thai", Tahoma, Arial, sans-serif; font-size: 11px; line-height: 1.5; }
    .page { width: 100%; margin: 0 auto; }
    .document-header { display: grid; grid-template-columns: 54px 1fr auto; gap: 14px; align-items: center; border-bottom: 3px solid #059669; padding-bottom: 12px; margin-bottom: 14px; }
    .brand-mark { width: 48px; height: 48px; display: grid; place-items: center; border: 2px solid #059669; border-radius: 12px; color: #059669; font-size: 24px; font-weight: 800; }
    .brand-copy p, .brand-copy h1, .brand-copy span { margin: 0; }
    .brand-copy p { color: #64748b; font-size: 10px; }
    .brand-copy h1 { color: #0f172a; font-size: 20px; line-height: 1.25; }
    .brand-copy span { color: #475569; }
    .document-ref { min-width: 145px; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; text-align: right; }
    .document-ref span, .document-ref strong { display: block; }
    .document-ref span { color: #64748b; font-size: 9px; }
    section { break-inside: avoid; margin: 0 0 13px; }
    section h2 { margin: 0; padding: 6px 9px; border-left: 4px solid #059669; background: #ecfdf5; color: #065f46; font-size: 12px; }
    .field-grid { display: grid; grid-template-columns: 1fr 1fr; border-top: 1px solid #e2e8f0; border-left: 1px solid #e2e8f0; }
    .field { min-height: 48px; padding: 7px 9px; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; }
    .field.wide { grid-column: 1 / -1; }
    .field span, .field strong { display: block; }
    .field span { color: #64748b; font-size: 9px; }
    .field strong { margin-top: 2px; color: #1e293b; font-weight: 600; white-space: pre-wrap; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 6px; border: 1px solid #cbd5e1; vertical-align: top; }
    th { background: #f1f5f9; color: #334155; font-size: 9px; }
    td small { display: block; color: #64748b; font-size: 8px; }
    .center { text-align: center; }
    .number { text-align: right; white-space: nowrap; }
    .empty { padding: 20px; color: #94a3b8; text-align: center; }
    .note { min-height: 70px; padding: 10px; border: 1px solid #cbd5e1; }
    .note p { margin: 4px 0 0; white-space: pre-wrap; }
    .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; margin-top: 32px; break-inside: avoid; }
    .signatures:has(.signature:nth-child(2):last-child) { grid-template-columns: repeat(2, 1fr); }
    .signature { text-align: center; color: #475569; }
    .signature span, .signature strong { display: block; }
    .signature strong { color: #1e293b; }
    .sign-line { height: 34px; border-bottom: 1px dotted #64748b; margin-bottom: 5px; }
    .cost-grid, .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 8px; }
    .cost-grid > div, .summary-grid > div { padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; }
    .cost-grid span, .cost-grid strong, .summary-grid span, .summary-grid strong, .summary-grid small { display: block; }
    .cost-grid span, .summary-grid span { color: #64748b; }
    .cost-grid strong { margin-top: 4px; font-size: 13px; }
    .cost-grid .total { border-color: #059669; background: #ecfdf5; color: #065f46; }
    .summary-grid { grid-template-columns: repeat(4, 1fr); margin: 0 0 13px; }
    .summary-grid strong { color: #059669; font-size: 20px; }
    .period-title, .report-total { display: flex; justify-content: space-between; align-items: center; padding: 9px 12px; border: 1px solid #cbd5e1; background: #f8fafc; }
    .period-title strong, .report-total strong { color: #047857; font-size: 13px; }
    footer { display: flex; justify-content: space-between; margin-top: 24px; padding-top: 8px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 8px; }
    @media screen { body { background: #e2e8f0; padding: 24px; } .page { max-width: 210mm; min-height: 297mm; padding: 12mm; background: white; box-shadow: 0 12px 35px rgb(15 23 42 / 18%); } }
    @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  </style></head><body><main class="page">${body}<footer><span>พิมพ์โดย ${escapeHtml(preparedBy)}</span><span>วันที่พิมพ์ ${escapeHtml(formatDate(preparedAt, true))}</span></footer></main>
  <script>window.addEventListener("load",()=>{window.setTimeout(()=>window.print(),250)});</script></body></html>`;
}

function openPrintWindow(title: string, html: string): boolean {
  const printWindow = window.open("", "_blank", "width=1100,height=800");
  if (!printWindow) return false;
  printWindow.opener = null;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.document.title = title;
  return true;
}

export function printMaintenanceJobDocument(
  request: MaintenanceJobPrintRequest,
): boolean {
  const { type, job, context } = request;
  const title =
    type === "WORK_ORDER"
      ? `ใบงานซ่อม ${job.jobNo}`
      : type === "PARTS_REQUEST"
        ? `ใบขอเบิกอะไหล่ ${job.jobNo}`
        : `ใบสรุปผลการซ่อม ${job.jobNo}`;
  const body =
    type === "WORK_ORDER"
      ? workOrderBody(job)
      : type === "PARTS_REQUEST"
        ? partsRequestBody(job)
        : repairSummaryBody(job);
  return openPrintWindow(
    title,
    documentShell(title, body, context.preparedBy, context.preparedAt),
  );
}

export function printMaintenancePeriodReport(
  request: MaintenancePeriodPrintRequest,
): boolean {
  const title = `รายงานงานซ่อม ${request.period.label}`;
  return openPrintWindow(
    title,
    documentShell(
      title,
      periodReportBody(request),
      request.context.preparedBy,
      request.context.preparedAt,
    ),
  );
}

export function hasRequestedSpareParts(job: RepairJob): boolean {
  return getRequestedParts(job).length > 0;
}
