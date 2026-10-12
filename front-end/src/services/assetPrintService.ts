// =============================================================
// File: src/services/assetPrintService.ts
// Standardized print service for Asset Stock (HAMS)
// =============================================================

import type { Asset } from "../types/TypeAsset";

export interface AssetPrintFilterInfo {
  search?: string;
  typeName?: string;
  sectionName?: string;
  statusName?: string;
  dateLabel?: string;
}

export interface AssetPrintSummaryStats {
  total: number;
  normal: number;
  repair?: number;
  underRepair?: number;
  damaged?: number;
  disposal?: number;
}

export interface AssetStockPrintRequest {
  title: string;
  subtitle?: string;
  reportRef?: string;
  filters?: AssetPrintFilterInfo;
  stats?: AssetPrintSummaryStats;
  assets: Asset[];
  isDisposal?: boolean;
  context: {
    preparedBy: string;
    preparedAt?: Date;
  };
}

export interface AssetCardPrintRequest {
  asset: Asset;
  repairJobs?: Array<{
    id?: string;
    jobNo?: string;
    description?: string;
    solution?: string;
    totalCost?: number;
    createdAt?: string;
    status?: { name?: string; code?: string };
    handlerName?: string;
  }>;
  usefulLifeYears?: number;
  context: {
    preparedBy: string;
    preparedAt?: Date;
  };
}

export interface AssetGroupedByDepartmentPrintRequest {
  title?: string;
  subtitle?: string;
  reportRef?: string;
  filters?: AssetPrintFilterInfo;
  assets: Asset[];
  context: {
    preparedBy: string;
    preparedAt?: Date;
  };
}

function escapeHtml(text: unknown): string {
  if (text === null || text === undefined) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(val: unknown, includeTime = false): string {
  if (!val) return "-";
  const d = new Date(val as string | number | Date);
  if (isNaN(d.getTime())) return "-";
  const thaiMonths = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
  ];
  const day = d.getDate();
  const month = thaiMonths[d.getMonth()];
  const year = d.getFullYear() + 543;
  if (!includeTime) {
    return `${day} ${month} ${year}`;
  }
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  return `${day} ${month} ${year} เวลา ${hours}:${mins}`;
}

function money(val: unknown): string {
  const num = Number(val);
  if (isNaN(num)) return "0.00";
  return num.toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function signature(title: string, name?: string): string {
  return `<div class="signature">
    <div class="sign-line"></div>
    <strong>(${escapeHtml(name || "...........................................................")})</strong>
    <span>${escapeHtml(title)}</span>
    <span>วันที่ ......../......../............</span>
  </div>`;
}

function field(label: string, value: unknown, wide = false): string {
  return `<div class="field${wide ? " wide" : ""}">
    <span>${escapeHtml(label)}</span>
    <strong>${escapeHtml(value || "-")}</strong>
  </div>`;
}

function documentShell(
  title: string,
  body: string,
  preparedBy: string,
  preparedAt: Date = new Date(),
): string {
  return `<!doctype html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #1e293b;
      font-family: "Noto Sans Thai", "Sarabun", Tahoma, Arial, sans-serif;
      font-size: 11px;
      line-height: 1.5;
    }
    .page { width: 100%; margin: 0 auto; }
    .document-header {
      display: grid;
      grid-template-columns: 56px 1fr auto;
      gap: 14px;
      align-items: center;
      border-bottom: 3px solid #059669;
      padding-bottom: 12px;
      margin-bottom: 14px;
    }
    .brand-mark {
      width: 48px;
      height: 48px;
      display: grid;
      place-items: center;
      border: 2px solid #059669;
      border-radius: 12px;
      color: #059669;
      font-size: 24px;
      font-weight: 800;
      background: #ecfdf5;
    }
    .brand-copy p, .brand-copy h1, .brand-copy span { margin: 0; }
    .brand-copy p { color: #64748b; font-size: 10px; }
    .brand-copy h1 { color: #0f172a; font-size: 18px; line-height: 1.3; }
    .brand-copy span { color: #475569; font-size: 11px; }
    .document-ref {
      min-width: 140px;
      padding: 8px 12px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      text-align: right;
      background: #f8fafc;
    }
    .document-ref span, .document-ref strong { display: block; }
    .document-ref span { color: #64748b; font-size: 9px; }
    section { margin: 0 0 14px; }
    section:not(.table-section) { break-inside: avoid; page-break-inside: avoid; }
    .table-section { break-inside: auto; page-break-inside: auto; }
    section h2 {
      margin: 0 0 6px 0;
      padding: 6px 10px;
      border-left: 4px solid #059669;
      background: #ecfdf5;
      color: #065f46;
      font-size: 12px;
      font-weight: 700;
      break-inside: avoid;
      page-break-inside: avoid;
      break-after: avoid;
      page-break-after: avoid;
    }
    .filter-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 16px;
      padding: 8px 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      margin-bottom: 12px;
      font-size: 10px;
    }
    .filter-bar span strong { color: #0f172a; }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 14px;
    }
    .summary-grid.cols-3 { grid-template-columns: repeat(3, 1fr); }
    .summary-grid > div {
      padding: 8px 10px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      background: white;
    }
    .summary-grid span { display: block; color: #64748b; font-size: 9px; }
    .summary-grid strong { display: block; color: #059669; font-size: 18px; line-height: 1.2; margin-top: 2px; }
    .summary-grid small { display: block; color: #94a3b8; font-size: 8px; }
    .field-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      border-top: 1px solid #cbd5e1;
      border-left: 1px solid #cbd5e1;
    }
    .field-grid.cols-3 { grid-template-columns: 1fr 1fr 1fr; }
    .field {
      min-height: 44px;
      padding: 6px 8px;
      border-right: 1px solid #cbd5e1;
      border-bottom: 1px solid #cbd5e1;
    }
    .field.wide { grid-column: 1 / -1; }
    .field span { display: block; color: #64748b; font-size: 9px; }
    .field strong { display: block; margin-top: 2px; color: #0f172a; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin-top: 4px; }
    th, td { padding: 6px 8px; border: 1px solid #cbd5e1; vertical-align: top; }
    th { background: #f1f5f9; color: #334155; font-size: 9px; text-align: left; }
    td small { display: block; color: #64748b; font-size: 8px; margin-top: 2px; }
    .center { text-align: center; }
    .number { text-align: right; white-space: nowrap; }
    .empty { padding: 24px; color: #94a3b8; text-align: center; }
    .badge {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 999px;
      font-size: 8.5px;
      font-weight: 600;
      border: 1px solid transparent;
    }
    .badge-normal { background: #ecfdf5; color: #047857; border-color: #a7f3d0; }
    .badge-damaged { background: #fff1f2; color: #be123c; border-color: #fecdd3; }
    .badge-repair { background: #fffbeb; color: #b45309; border-color: #fde68a; }
    .badge-disposal { background: #f8fafc; color: #475569; border-color: #cbd5e1; }
    .signatures {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 32px;
      margin-top: 32px;
      break-inside: avoid;
    }
    .signatures.cols-3 { grid-template-columns: repeat(3, 1fr); }
    .signature { text-align: center; color: #475569; }
    .signature span, .signature strong { display: block; }
    .signature strong { color: #0f172a; margin-top: 4px; }
    .sign-line { height: 32px; border-bottom: 1px dotted #64748b; margin-bottom: 6px; }
    footer {
      display: flex;
      justify-content: space-between;
      margin-top: 24px;
      padding-top: 8px;
      border-top: 1px solid #e2e8f0;
      color: #94a3b8;
      font-size: 8px;
    }
    .department-block {
      margin-bottom: 24px;
      page-break-inside: auto;
    }
    .department-header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-left: 5px solid #059669;
      border-radius: 4px;
      margin-bottom: 8px;
    }
    .department-header-bar h3 {
      margin: 0;
      color: #0f172a;
      font-size: 13px;
      font-weight: 700;
    }
    .department-header-bar .dept-badges {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 10px;
      flex-shrink: 0;
      flex-wrap: wrap;
    }
    .dept-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      background: white;
      border: 1px solid #cbd5e1;
      border-radius: 999px;
      color: #334155;
      font-weight: 600;
      white-space: nowrap;
      flex-shrink: 0;
      line-height: 1.2;
    }
    @media screen {
      body { background: #f1f5f9; padding: 24px; }
      .page {
        max-width: 210mm;
        min-height: 297mm;
        padding: 14mm;
        background: white;
        box-shadow: 0 10px 25px rgb(0 0 0 / 10%);
        border-radius: 4px;
      }
    }
    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .department-block {
        margin-bottom: 20px;
        page-break-inside: auto;
      }
      .department-header-bar {
        break-inside: avoid;
        page-break-inside: avoid;
        break-after: avoid;
        page-break-after: avoid;
      }
      thead { display: table-header-group; }
      tr { break-inside: avoid; page-break-inside: avoid; }
      .report-summary-signatures, .signatures {
        break-inside: avoid;
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <main class="page">
    ${body}
    <footer>
      <span>พิมพ์โดย: ${escapeHtml(preparedBy)}</span>
      <span>ระบบบริหารจัดการครุภัณฑ์และสินทรัพย์ (HAMS)</span>
      <span>วันที่พิมพ์: ${escapeHtml(formatDate(preparedAt, true))}</span>
    </footer>
  </main>
  <script>
    window.addEventListener("load", () => {
      window.setTimeout(() => window.print(), 250);
    });
  </script>
</body>
</html>`;
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

function getBadgeHtml(statusName?: string, statusCode?: string): string {
  const code = (statusCode || "").toUpperCase();
  const name = statusName || "-";
  if (code === "NORMAL") return `<span class="badge badge-normal">${escapeHtml(name)}</span>`;
  if (code === "DAMAGED" || code === "LOST") return `<span class="badge badge-damaged">${escapeHtml(name)}</span>`;
  if (code === "UNDER_REPAIR" || code === "WAIT_DISPOSAL") return `<span class="badge badge-repair">${escapeHtml(name)}</span>`;
  return `<span class="badge badge-disposal">${escapeHtml(name)}</span>`;
}

function getWarrantyHtml(warrantyDateStr?: string | null): string {
  if (!warrantyDateStr) return `<small style="color: #94a3b8; display: block; font-size: 8px; margin-top: 2px;">(ไม่ระบุประกัน)</small>`;
  const d = new Date(warrantyDateStr);
  if (isNaN(d.getTime())) return `<small style="color: #94a3b8; display: block; font-size: 8px; margin-top: 2px;">-</small>`;
  const isExpired = d.getTime() < Date.now();
  const dateShort = `${d.getDate()}/${d.getMonth() + 1}/${(d.getFullYear() + 543).toString().slice(2)}`;
  if (isExpired) {
    return `<small style="color: #be123c; font-weight: 600; display: block; font-size: 8px; margin-top: 2px; white-space: nowrap;">หมดประกัน (${dateShort})</small>`;
  }
  return `<small style="color: #047857; font-weight: 600; display: block; font-size: 8px; margin-top: 2px; white-space: nowrap;">ในประกัน (${dateShort})</small>`;
}

// -------------------------------------------------------------
// Report 1: สรุปรายการสต็อกครุภัณฑ์ (Asset Stock Report)
// -------------------------------------------------------------
export function printAssetStockReport(request: AssetStockPrintRequest): boolean {
  const {
    title,
    subtitle = "ระบบบริหารจัดการครุภัณฑ์และสินทรัพย์ (HAMS)",
    reportRef,
    filters,
    stats,
    assets,
    isDisposal = false,
    context,
  } = request;

  const refCode = reportRef || `AST-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;

  let filterBarHtml = "";
  if (filters) {
    const filterItems: string[] = [];
    if (filters.search) filterItems.push(`คำค้นหา: <strong>${escapeHtml(filters.search)}</strong>`);
    if (filters.typeName && filters.typeName !== "ทั้งหมด") filterItems.push(`ประเภท: <strong>${escapeHtml(filters.typeName)}</strong>`);
    if (filters.sectionName && filters.sectionName !== "ทั้งหมด") filterItems.push(`แผนก: <strong>${escapeHtml(filters.sectionName)}</strong>`);
    if (filters.statusName && filters.statusName !== "ทั้งหมด") filterItems.push(`สถานะ: <strong>${escapeHtml(filters.statusName)}</strong>`);
    if (filters.dateLabel && filters.dateLabel !== "ทั้งหมด") filterItems.push(`วันที่: <strong>${escapeHtml(filters.dateLabel)}</strong>`);

    if (filterItems.length > 0) {
      filterBarHtml = `<div class="filter-bar"><span>ตัวกรองที่ระบุ: </span>${filterItems.map((item) => `<span>${item}</span>`).join(" • ")}</div>`;
    }
  }

  let summaryHtml = "";
  if (stats) {
    if (stats.underRepair !== undefined && stats.damaged !== undefined) {
      summaryHtml = `<div class="summary-grid" style="grid-template-columns: repeat(4, 1fr); margin-bottom: 16px;">
        <div>
          <span>รวมทั้งหมด</span>
          <strong>${stats.total.toLocaleString()}</strong>
          <small>รายการ</small>
        </div>
        <div>
          <span>สภาพปกติ</span>
          <strong style="color: #047857;">${stats.normal.toLocaleString()}</strong>
          <small>รายการ</small>
        </div>
        <div>
          <span>กำลังซ่อม</span>
          <strong style="color: #0284c7;">${stats.underRepair.toLocaleString()}</strong>
          <small>รายการ</small>
        </div>
        <div>
          <span>ชำรุด</span>
          <strong style="color: #be123c;">${stats.damaged.toLocaleString()}</strong>
          <small>รายการ</small>
        </div>
      </div>`;
    } else {
      summaryHtml = `<div class="summary-grid ${isDisposal ? "cols-3" : ""}">
        <div>
          <span>รวมทั้งหมด</span>
          <strong>${stats.total.toLocaleString()}</strong>
          <small>รายการ</small>
        </div>
        <div>
          <span>สภาพปกติ</span>
          <strong style="color: #047857;">${stats.normal.toLocaleString()}</strong>
          <small>รายการ</small>
        </div>
        <div>
          <span>ชำรุด / ส่งซ่อม</span>
          <strong style="color: #b45309;">${(stats.repair ?? 0).toLocaleString()}</strong>
          <small>รายการ</small>
        </div>
        ${
          !isDisposal && stats.disposal !== undefined
            ? `<div>
                <span>รอจำหน่าย / จำหน่าย</span>
                <strong style="color: #475569;">${stats.disposal.toLocaleString()}</strong>
                <small>รายการ</small>
              </div>`
            : ""
        }
      </div>`;
    }
  }

  const tableRows = assets.length
    ? assets
        .map((a, idx) => {
          const pid = a.noid || a.id;
          const brandModel = [a.model].filter(Boolean).join(" ");
          const building = a.section?.building
            ? `<small style="color: #64748b;">อาคาร${escapeHtml(a.section.building)}</small>`
            : "";
          return `<tr>
            <td class="center">${idx + 1}</td>
            <td style="font-family: monospace; font-weight: 600;">${escapeHtml(pid)}</td>
            <td>
              <strong>${escapeHtml(a.name || "-")}</strong>
              ${brandModel ? `<small>ยี่ห้อ/รุ่น: ${escapeHtml(brandModel)}</small>` : ""}
            </td>
            <td class="center">${escapeHtml(a.serialNo || "-")}</td>
            <td>
              <div>${escapeHtml(a.section?.name || "ครุภัณฑ์ส่วนกลาง")}</div>
              ${building}
            </td>
            <td class="center">${getBadgeHtml(a.status?.name, a.status?.code)}</td>
            <td class="number">${a.price ? `${money(a.price)}` : "-"}</td>
          </tr>`;
        })
        .join("")
    : `<tr><td colspan="7" class="empty">ไม่พบรายการครุภัณฑ์ตามเงื่อนไขที่เลือก</td></tr>`;

  const totalAmount = assets.reduce((sum, item) => sum + Number(item.price || 0), 0);

  const body = `
    <header class="document-header">
      <div class="brand-mark">H</div>
      <div class="brand-copy">
        <p>โรงพยาบาลและหน่วยงานในสังกัด</p>
        <h1>${escapeHtml(title)}</h1>
        <span>${escapeHtml(subtitle)}</span>
      </div>
      <div class="document-ref">
        <span>เลขที่อ้างอิง</span>
        <strong>${escapeHtml(refCode)}</strong>
      </div>
    </header>

    ${filterBarHtml}
    ${summaryHtml}

    <section class="table-section">
      <h2>รายการครุภัณฑ์ (${assets.length} รายการ)</h2>
      <table>
        <thead>
          <tr>
            <th class="center" style="width: 38px;">ลำดับ</th>
            <th style="width: 130px;">รหัสครุภัณฑ์ (PID)</th>
            <th>ชื่อครุภัณฑ์ / ยี่ห้อ-รุ่น</th>
            <th class="center" style="width: 110px;">หมายเลขเครื่อง (S/N)</th>
            <th style="width: 140px;">หน่วยงานที่รับผิดชอบ</th>
            <th class="center" style="width: 95px;">สถานะ</th>
            <th class="number" style="width: 95px;">ราคา (บาท)</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    </section>

    <div class="report-summary-signatures" style="break-inside: avoid; page-break-inside: avoid; margin-top: 24px;">
      ${
        assets.length > 0 && totalAmount > 0
          ? `<section style="margin: 0 0 24px 0; padding: 12px; border: 2px solid #059669; border-radius: 8px; background: #ecfdf5; display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 13px; font-weight: 700; color: #065f46;">มูลค่ารวมครุภัณฑ์ทั้งหมด (${assets.length.toLocaleString()} รายการ)</span>
              <strong style="font-size: 16px; color: #047857;">${money(totalAmount)} บาท</strong>
            </section>`
          : ""
      }

      <div class="signatures" style="margin-top: 20px;">
        ${signature("ผู้จัดทำรายงาน", context.preparedBy)}
        ${signature(isDisposal ? "หัวหน้างานพัสดุและบำรุงรักษา" : "หัวหน้างานศูนย์บริหารสินทรัพย์")}
      </div>
    </div>
  `;

  return openPrintWindow(
    title,
    documentShell(title, body, context.preparedBy, context.preparedAt || new Date()),
  );
}

// -------------------------------------------------------------
// Report 2: บัตรประวัติและทะเบียนคุมครุภัณฑ์รายชิ้น (Asset Profile Card)
// -------------------------------------------------------------
export function printAssetSingleCard(request: AssetCardPrintRequest): boolean {
  const { asset, repairJobs = [], usefulLifeYears, context } = request;

  const title = `บัตรประวัติครุภัณฑ์ ${asset.noid || asset.id}`;
  const pid = asset.noid || asset.id;

  const repairRows = repairJobs.length
    ? repairJobs
        .map((job, idx) => {
          return `<tr>
            <td class="center">${idx + 1}</td>
            <td class="center" style="white-space: nowrap;">${escapeHtml(formatDate(job.createdAt))}</td>
            <td style="font-family: monospace; font-weight: 600;">${escapeHtml(job.jobNo || "-")}</td>
            <td>
              <strong>${escapeHtml(job.description || "-")}</strong>
              ${job.solution ? `<small>การแก้ไข: ${escapeHtml(job.solution)}</small>` : ""}
            </td>
            <td>${escapeHtml(job.handlerName || "-")}</td>
            <td class="number">${job.totalCost ? money(job.totalCost) : "-"}</td>
            <td class="center">${escapeHtml(job.status?.name || "-")}</td>
          </tr>`;
        })
        .join("")
    : `<tr><td colspan="7" class="empty">ไม่มีประวัติการแจ้งซ่อมบำรุง</td></tr>`;

  const totalRepairCost = repairJobs.reduce(
    (sum, job) => sum + Number(job.totalCost || 0),
    0,
  );

  const body = `
    <header class="document-header">
      <div class="brand-mark">H</div>
      <div class="brand-copy">
        <p>โรงพยาบาลและหน่วยงานในสังกัด</p>
        <h1>ทะเบียนคุมและบัตรประวัติครุภัณฑ์</h1>
        <span>รหัสครุภัณฑ์ (PID): ${escapeHtml(pid)}</span>
      </div>
      <div class="document-ref">
        <span>สถานะปัจจุบัน</span>
        <strong>${escapeHtml(asset.status?.name || "ใช้งานปกติ")}</strong>
      </div>
    </header>

    <section>
      <h2>1. ข้อมูลทั่วไปของครุภัณฑ์</h2>
      <div class="field-grid">
        ${field("รหัสครุภัณฑ์ (PID / Noid)", pid)}
        ${field("ชื่อครุภัณฑ์", asset.name)}
        ${field("ยี่ห้อ / รุ่น (Brand / Model)", asset.model || "-")}
        ${field("หมายเลขเครื่อง (Serial Number)", asset.serialNo || "-")}
        ${field("ประเภทครุภัณฑ์", asset.type?.name || asset.equipmentType?.name || "-")}
        ${field("ระดับความเสี่ยง (Risk Level)", asset.riskLevel || "-")}
        ${field("หน่วยงานที่รับผิดชอบ", asset.section?.name || "-")}
        ${field("สถานที่ติดตั้ง / อาคาร", asset.section?.building || "-")}
        ${field("ผู้รับผิดชอบ / ผู้ครอบครอง", asset.owner ? `${asset.owner.firstname} ${asset.owner.lastname}` : "-")}
        ${field("หมายเหตุ", asset.remark || "-", true)}
      </div>
    </section>

    <section>
      <h2>2. ข้อมูลการจัดซื้อและงบประมาณ</h2>
      <div class="field-grid cols-3">
        ${field("ราคาจัดซื้อ (บาท)", asset.price ? money(asset.price) : "-")}
        ${field("วันที่ตรวจรับ / เริ่มใช้งาน", formatDate(asset.receivedDate))}
        ${field("วิธีการได้มา", asset.acqType || "-")}
        ${field("ประเภทงบประมาณ", asset.budgetType || "-")}
        ${field("บริษัทคู่ค้า / ผู้จำหน่าย", asset.company?.name || "-")}
        ${field("อายุการใช้งานกำหนด (ปี)", usefulLifeYears ? `${usefulLifeYears} ปี` : "-")}
      </div>
    </section>

    <section class="table-section">
      <h2>3. ประวัติการบำรุงรักษาและซ่อมแซม (${repairJobs.length} ครั้ง)</h2>
      <table>
        <thead>
          <tr>
            <th class="center" style="width: 35px;">ลำดับ</th>
            <th class="center" style="width: 90px;">วันที่</th>
            <th style="width: 110px;">เลขที่ใบแจ้งซ่อม</th>
            <th>อาการ / การดำเนินการ</th>
            <th style="width: 120px;">ผู้ดำเนินการ</th>
            <th class="number" style="width: 90px;">ค่าใช้จ่าย (บาท)</th>
            <th class="center" style="width: 85px;">สถานะงาน</th>
          </tr>
        </thead>
        <tbody>
          ${repairRows}
        </tbody>
        ${
          repairJobs.length > 0 && totalRepairCost > 0
            ? `<tfoot>
                <tr style="background: #f8fafc; font-weight: 700;">
                  <td colspan="5" style="text-align: right; padding-right: 12px;">รวมค่าซ่อมบำรุงสะสมทั้งหมด</td>
                  <td class="number" style="color: #047857;">${money(totalRepairCost)}</td>
                  <td></td>
                </tr>
              </tfoot>`
            : ""
        }
      </table>
    </section>

    <div class="signatures">
      ${signature("เจ้าหน้าที่ผู้รับผิดชอบครุภัณฑ์")}
      ${signature("เจ้าหน้าที่ผู้บันทึก/ตรวจสอบข้อมูล", context.preparedBy)}
    </div>
  `;

  return openPrintWindow(
    title,
    documentShell(title, body, context.preparedBy, context.preparedAt || new Date()),
  );
}

// -------------------------------------------------------------
// Report 3: สรุปรายการสต็อกครุภัณฑ์แยกตามแผนก (Grouped by Department)
// -------------------------------------------------------------
export function printAssetStockGroupedByDepartmentReport(
  request: AssetGroupedByDepartmentPrintRequest,
): boolean {
  const {
    title = "รายงานสรุปสต็อกครุภัณฑ์แยกตามแผนก",
    subtitle = "ศูนย์บริหารจัดการสินทรัพย์ (Asset Center) • สรุปรายการตามหน่วยงาน",
    reportRef,
    filters,
    assets,
    context,
  } = request;

  const refCode =
    reportRef ||
    `AST-GRP-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;

  interface DeptGroup {
    sectionId: string;
    sectionName: string;
    building?: string;
    assets: Asset[];
    totalCost: number;
    normalCount: number;
    damagedCount: number;
    underRepairCount: number;
  }

  const groupMap = new Map<string, DeptGroup>();

  for (const asset of assets) {
    const secId = asset.section?.id || "NO_DEPT";
    const secName = asset.section?.name || "ไม่ระบุแผนก / ครุภัณฑ์ส่วนกลาง";
    const building = asset.section?.building;

    if (!groupMap.has(secId)) {
      groupMap.set(secId, {
        sectionId: secId,
        sectionName: secName,
        building,
        assets: [],
        totalCost: 0,
        normalCount: 0,
        damagedCount: 0,
        underRepairCount: 0,
      });
    }

    const group = groupMap.get(secId)!;
    group.assets.push(asset);
    group.totalCost += Number(asset.price || 0);

    const code = (asset.status?.code || "").toUpperCase();
    if (code === "NORMAL") group.normalCount += 1;
    else if (code === "DAMAGED") group.damagedCount += 1;
    else if (code === "UNDER_REPAIR") group.underRepairCount += 1;
  }

  const sortedGroups = Array.from(groupMap.values()).sort((a, b) =>
    a.sectionName.localeCompare(b.sectionName, "th"),
  );

  const totalAssetsCount = assets.length;
  const totalNormalCount = assets.filter(
    (a) => a.status?.code === "NORMAL",
  ).length;
  const totalUnderRepairCount = assets.filter(
    (a) => a.status?.code === "UNDER_REPAIR",
  ).length;
  const totalDamagedCount = assets.filter(
    (a) => a.status?.code === "DAMAGED",
  ).length;
  const totalAmount = assets.reduce(
    (sum, item) => sum + Number(item.price || 0),
    0,
  );

  let filterBarHtml = "";
  if (filters) {
    const filterItems: string[] = [];
    if (filters.search)
      filterItems.push(`คำค้นหา: <strong>${escapeHtml(filters.search)}</strong>`);
    if (filters.typeName && filters.typeName !== "ทั้งหมด")
      filterItems.push(
        `ประเภท: <strong>${escapeHtml(filters.typeName)}</strong>`,
      );
    if (filters.statusName && filters.statusName !== "ทั้งหมด")
      filterItems.push(
        `สถานะ: <strong>${escapeHtml(filters.statusName)}</strong>`,
      );

    if (filterItems.length > 0) {
      filterBarHtml = `<div class="filter-bar"><span>เงื่อนไขการค้นหา: </span>${filterItems.join(" • ")}</div>`;
    }
  }

  const overallSummaryHtml = `
    <div style="font-size: 11px; color: #475569; margin-bottom: 8px;">
      ข้อมูลภาพรวมครุภัณฑ์แยกตามแผนก (ครอบคลุมทั้งหมด <strong>${sortedGroups.length.toLocaleString()}</strong> หน่วยงาน)
    </div>
    <div class="summary-grid" style="grid-template-columns: repeat(4, 1fr); margin-bottom: 16px;">
      <div>
        <span>รวมทั้งหมด</span>
        <strong>${totalAssetsCount.toLocaleString()}</strong>
        <small>รายการ</small>
      </div>
      <div>
        <span>สภาพปกติ</span>
        <strong style="color: #047857;">${totalNormalCount.toLocaleString()}</strong>
        <small>รายการ</small>
      </div>
      <div>
        <span>กำลังซ่อม</span>
        <strong style="color: #0284c7;">${totalUnderRepairCount.toLocaleString()}</strong>
        <small>รายการ</small>
      </div>
      <div>
        <span>ชำรุด</span>
        <strong style="color: #be123c;">${totalDamagedCount.toLocaleString()}</strong>
        <small>รายการ</small>
      </div>
    </div>
  `;

  const deptBlocksHtml = sortedGroups
    .map((grp, gIdx) => {
      const rows = grp.assets
        .map((a, rIdx) => {
          const pid = a.noid || a.id;
          const brandModel = [a.model].filter(Boolean).join(" ");
          return `<tr>
            <td class="center">${rIdx + 1}</td>
            <td style="font-family: monospace; font-weight: 600;">${escapeHtml(pid)}</td>
            <td>
              <strong>${escapeHtml(a.name || "-")}</strong>
              ${brandModel ? `<small>ยี่ห้อ/รุ่น: ${escapeHtml(brandModel)}</small>` : ""}
            </td>
            <td class="center">${escapeHtml(a.serialNo || "-")}</td>
            <td class="center">${getBadgeHtml(a.status?.name, a.status?.code)}</td>
            <td class="number">${a.price ? money(a.price) : "-"}</td>
          </tr>`;
        })
        .join("");

      return `
        <div class="department-block">
          <div class="department-header-bar">
            <div>
              <h3>ลำดับที่ ${gIdx + 1}. แผนก: ${escapeHtml(grp.sectionName)}</h3>
              ${grp.building ? `<small style="color: #64748b;">สถานที่/อาคาร: ${grp.building.startsWith("อาคาร") ? "" : "อาคาร"}${escapeHtml(grp.building)}</small>` : ""}
            </div>
            <div class="dept-badges">
              <span class="dept-badge">รวม: <strong>${grp.assets.length}</strong></span>
              <span class="dept-badge" style="color: #047857;">ปกติ: <strong>${grp.normalCount}</strong></span>
              ${grp.underRepairCount > 0 ? `<span class="dept-badge" style="color: #0284c7;">ซ่อม: <strong>${grp.underRepairCount}</strong></span>` : ""}
              ${grp.damagedCount > 0 ? `<span class="dept-badge" style="color: #be123c;">ชำรุด: <strong>${grp.damagedCount}</strong></span>` : ""}
              <span class="dept-badge" style="color: #047857;">มูลค่า: <strong>${money(grp.totalCost)}</strong> บ.</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th class="center" style="width: 38px;">ลำดับ</th>
                <th style="width: 140px;">รหัสครุภัณฑ์ (PID)</th>
                <th>ชื่อครุภัณฑ์ / ยี่ห้อ-รุ่น</th>
                <th class="center" style="width: 120px;">หมายเลขเครื่อง (S/N)</th>
                <th class="center" style="width: 100px;">สถานะ</th>
                <th class="number" style="width: 110px;">ราคา (บาท)</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
              ${
                grp.totalCost > 0
                  ? `<tr style="background: #f8fafc; font-weight: 700; break-inside: avoid; page-break-inside: avoid;">
                      <td colspan="5" style="text-align: right; padding-right: 12px;">รวมแผนก ${escapeHtml(grp.sectionName)} (${grp.assets.length} รายการ)</td>
                      <td class="number" style="color: #047857;">${money(grp.totalCost)}</td>
                    </tr>`
                  : ""
              }
            </tbody>
          </table>
        </div>
      `;
    })
    .join("");

  const body = `
    <header class="document-header">
      <div class="brand-mark">H</div>
      <div class="brand-copy">
        <p>โรงพยาบาลและหน่วยงานในสังกัด</p>
        <h1>${escapeHtml(title)}</h1>
        <span>${escapeHtml(subtitle)}</span>
      </div>
      <div class="document-ref">
        <span>เลขที่อ้างอิง</span>
        <strong>${escapeHtml(refCode)}</strong>
      </div>
    </header>

    ${filterBarHtml}
    ${overallSummaryHtml}

    ${deptBlocksHtml}

    <div class="report-summary-signatures" style="break-inside: avoid; page-break-inside: avoid; margin-top: 24px;">
      <section style="margin: 0 0 24px 0; padding: 12px; border: 2px solid #059669; border-radius: 8px; background: #ecfdf5; display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 13px; font-weight: 700; color: #065f46;">มูลค่ารวมครุภัณฑ์ทั้งหมดทุกแผนก (${totalAssetsCount.toLocaleString()} รายการ)</span>
        <strong style="font-size: 16px; color: #047857;">${money(totalAmount)} บาท</strong>
      </section>

      <div class="signatures" style="margin-top: 20px;">
        ${signature("ผู้จัดทำรายงาน", context.preparedBy)}
        ${signature("หัวหน้างานศูนย์บริหารสินทรัพย์")}
      </div>
    </div>
  `;

  return openPrintWindow(
    title,
    documentShell(title, body, context.preparedBy, context.preparedAt || new Date()),
  );
}

// -------------------------------------------------------------
// Report 4: รายงานสต็อกครุภัณฑ์สำหรับฝ่ายพัสดุ (Equipment Stock - Parcel)
// -------------------------------------------------------------
export interface EquipmentStockPrintRequest {
  title?: string;
  subtitle?: string;
  reportRef?: string;
  activeTab?: "ALL" | "WAIT_DISPOSAL" | "DISPOSAL" | "LOST";
  filters?: {
    search?: string;
    typeName?: string;
    statusName?: string;
    dateLabel?: string;
  };
  stats?: AssetPrintSummaryStats;
  assets: Asset[];
  context: {
    preparedBy: string;
    preparedAt?: Date;
  };
}

export function printEquipmentStockReport(
  request: EquipmentStockPrintRequest,
): boolean {
  const {
    activeTab = "ALL",
    reportRef,
    filters,
    stats,
    assets,
    context,
  } = request;

  let defaultTitle = "รายงานทะเบียนคุมสต็อกครุภัณฑ์ (งานพัสดุ)";
  let defaultSubtitle = "ฝ่ายพัสดุและบำรุงรักษา • ทะเบียนคุมพัสดุและสินทรัพย์ถาวร";

  if (activeTab === "WAIT_DISPOSAL") {
    defaultTitle = "บัญชีรายการครุภัณฑ์รอจำหน่าย (ขออนุมัติจำหน่าย)";
    defaultSubtitle = "ฝ่ายพัสดุและบำรุงรักษา • บัญชีสำรวจครุภัณฑ์ชำรุดเสื่อมสภาพเพื่อขออนุมัติแทงจำหน่าย";
  } else if (activeTab === "DISPOSAL") {
    defaultTitle = "บัญชีรายการครุภัณฑ์ที่จำหน่ายแล้ว (ตัดจำหน่ายออกจากบัญชี)";
    defaultSubtitle = "ฝ่ายพัสดุและบำรุงรักษา • ทะเบียนคุมการตัดจำหน่ายพัสดุและสินทรัพย์ถาวร";
  } else if (activeTab === "LOST") {
    defaultTitle = "รายงานสรุปรายการครุภัณฑ์สูญหาย";
    defaultSubtitle = "ฝ่ายพัสดุและบำรุงรักษา • บัญชีตรวจสอบและรายงานครุภัณฑ์สูญหาย";
  }

  const title = request.title || defaultTitle;
  const subtitle = request.subtitle || defaultSubtitle;
  const refCode =
    reportRef ||
    `PCL-${activeTab.slice(0, 3)}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;

  let filterBarHtml = "";
  if (filters) {
    const filterItems: string[] = [];
    if (filters.search) filterItems.push(`คำค้นหา: <strong>${escapeHtml(filters.search)}</strong>`);
    if (filters.typeName && filters.typeName !== "ทั้งหมด") filterItems.push(`ประเภท: <strong>${escapeHtml(filters.typeName)}</strong>`);
    if (filters.statusName && filters.statusName !== "ทั้งหมด") filterItems.push(`สถานะ: <strong>${escapeHtml(filters.statusName)}</strong>`);
    if (filters.dateLabel && filters.dateLabel !== "ทั้งหมด") filterItems.push(`วันที่: <strong>${escapeHtml(filters.dateLabel)}</strong>`);

    if (filterItems.length > 0) {
      filterBarHtml = `<div class="filter-bar"><span>ตัวกรองที่ระบุ: </span>${filterItems.map((item) => `<span>${item}</span>`).join(" • ")}</div>`;
    }
  }

  let summaryHtml = "";
  if (stats) {
    const isSpecialTab = activeTab !== "ALL";
    summaryHtml = `<div class="summary-grid ${isSpecialTab ? "cols-3" : ""}">
      <div>
        <span>จำนวนรายการทั้งหมด</span>
        <strong>${stats.total.toLocaleString()}</strong>
        <small>รายการ</small>
      </div>
      <div>
        <span>สภาพปกติ (พร้อมใช้)</span>
        <strong style="color: #047857;">${stats.normal.toLocaleString()}</strong>
        <small>รายการ</small>
      </div>
      <div>
        <span>ชำรุด / ส่งซ่อม</span>
        <strong style="color: #b45309;">${stats.repair.toLocaleString()}</strong>
        <small>รายการ</small>
      </div>
      ${
        !isSpecialTab && stats.disposal !== undefined
          ? `<div>
              <span>รอจำหน่าย / จำหน่ายแล้ว / สูญหาย</span>
              <strong style="color: #475569;">${stats.disposal.toLocaleString()}</strong>
              <small>รายการ</small>
            </div>`
          : ""
      }
    </div>`;
  }

  let tableHeaderHtml = "";
  let tableRowsHtml = "";

  if (activeTab === "WAIT_DISPOSAL") {
    tableHeaderHtml = `<tr>
      <th class="center" style="width: 35px;">ลำดับ</th>
      <th style="width: 120px;">รหัสครุภัณฑ์ (PID)</th>
      <th>ชื่อครุภัณฑ์ / ยี่ห้อ-รุ่น</th>
      <th class="center" style="width: 105px;">หมายเลขเครื่อง (S/N)</th>
      <th style="width: 130px;">หน่วยงานที่ส่งคืน</th>
      <th style="width: 140px;">เหตุผลการขอจำหน่าย</th>
      <th class="center" style="width: 95px;">วันที่รับ / ประกัน</th>
      <th class="number" style="width: 85px;">ราคาจัดซื้อ (บ.)</th>
    </tr>`;

    tableRowsHtml = assets.length
      ? assets
          .map((a, idx) => {
            const pid = a.noid || a.id;
            const brandModel = [a.model, a.company?.name].filter(Boolean).join(" / ");
            const reason = a.remark || "ซ่อมไม่คุ้มค่า / เสื่อมสภาพตามอายุการใช้งาน";
            return `<tr>
              <td class="center">${idx + 1}</td>
              <td style="font-family: monospace; font-weight: 600;">${escapeHtml(pid)}</td>
              <td>
                <strong>${escapeHtml(a.name || "-")}</strong>
                ${brandModel ? `<small>ยี่ห้อ/รุ่น: ${escapeHtml(brandModel)}</small>` : ""}
              </td>
              <td class="center">${escapeHtml(a.serialNo || "-")}</td>
              <td>${escapeHtml(a.section?.name || "ครุภัณฑ์ส่วนกลาง")}</td>
              <td><span style="color: #b45309; font-weight: 500;">${escapeHtml(reason)}</span></td>
              <td class="center" style="white-space: nowrap;">
                <div>${formatDate(a.receivedDate)}</div>
                ${getWarrantyHtml(a.warrantyDate)}
              </td>
              <td class="number">${a.price ? money(a.price) : "-"}</td>
            </tr>`;
          })
          .join("")
      : `<tr><td colspan="8" class="empty">ไม่พบรายการครุภัณฑ์รอจำหน่าย</td></tr>`;
  } else if (activeTab === "DISPOSAL") {
    tableHeaderHtml = `<tr>
      <th class="center" style="width: 35px;">ลำดับ</th>
      <th style="width: 125px;">รหัสครุภัณฑ์ (PID)</th>
      <th>ชื่อครุภัณฑ์ / ยี่ห้อ-รุ่น</th>
      <th class="center" style="width: 110px;">หมายเลขเครื่อง (S/N)</th>
      <th style="width: 130px;">หน่วยงานเดิม</th>
      <th class="center" style="width: 100px;">วิธีการจำหน่าย</th>
      <th class="center" style="width: 90px;">วันที่จำหน่าย</th>
      <th class="number" style="width: 95px;">ราคาทุน (บ.)</th>
    </tr>`;

    tableRowsHtml = assets.length
      ? assets
          .map((a, idx) => {
            const pid = a.noid || a.id;
            const brandModel = [a.model, a.company?.name].filter(Boolean).join(" / ");
            const method = a.remark || "ตัดจำหน่ายออกจากบัญชี";
            return `<tr>
              <td class="center">${idx + 1}</td>
              <td style="font-family: monospace; font-weight: 600;">${escapeHtml(pid)}</td>
              <td>
                <strong>${escapeHtml(a.name || "-")}</strong>
                ${brandModel ? `<small>ยี่ห้อ/รุ่น: ${escapeHtml(brandModel)}</small>` : ""}
              </td>
              <td class="center">${escapeHtml(a.serialNo || "-")}</td>
              <td>${escapeHtml(a.section?.name || "ครุภัณฑ์ส่วนกลาง")}</td>
              <td class="center"><span class="badge badge-disposal">${escapeHtml(method)}</span></td>
              <td class="center">${formatDate(a.updatedAt || a.receivedDate)}</td>
              <td class="number">${a.price ? money(a.price) : "-"}</td>
            </tr>`;
          })
          .join("")
      : `<tr><td colspan="8" class="empty">ไม่พบรายการครุภัณฑ์ที่จำหน่ายแล้ว</td></tr>`;
  } else if (activeTab === "LOST") {
    tableHeaderHtml = `<tr>
      <th class="center" style="width: 35px;">ลำดับ</th>
      <th style="width: 125px;">รหัสครุภัณฑ์ (PID)</th>
      <th>ชื่อครุภัณฑ์ / ยี่ห้อ-รุ่น</th>
      <th class="center" style="width: 110px;">หมายเลขเครื่อง (S/N)</th>
      <th style="width: 140px;">หน่วยงานที่รับผิดชอบ</th>
      <th class="center" style="width: 95px;">วันที่บันทึก</th>
      <th style="width: 140px;">หมายเหตุ</th>
      <th class="number" style="width: 95px;">ราคาทุน (บ.)</th>
    </tr>`;

    tableRowsHtml = assets.length
      ? assets
          .map((a, idx) => {
            const pid = a.noid || a.id;
            const brandModel = [a.model, a.company?.name].filter(Boolean).join(" / ");
            return `<tr>
              <td class="center">${idx + 1}</td>
              <td style="font-family: monospace; font-weight: 600;">${escapeHtml(pid)}</td>
              <td>
                <strong>${escapeHtml(a.name || "-")}</strong>
                ${brandModel ? `<small>ยี่ห้อ/รุ่น: ${escapeHtml(brandModel)}</small>` : ""}
              </td>
              <td class="center">${escapeHtml(a.serialNo || "-")}</td>
              <td>${escapeHtml(a.section?.name || "ครุภัณฑ์ส่วนกลาง")}</td>
              <td class="center">${formatDate(a.updatedAt || a.receivedDate)}</td>
              <td><span style="color: #be123c;">${escapeHtml(a.remark || "แจ้งสูญหาย")}</span></td>
              <td class="number">${a.price ? money(a.price) : "-"}</td>
            </tr>`;
          })
          .join("")
      : `<tr><td colspan="8" class="empty">ไม่พบรายการครุภัณฑ์สูญหาย</td></tr>`;
  } else {
    // Standard ALL tab
    tableHeaderHtml = `<tr>
      <th class="center" style="width: 35px;">ลำดับ</th>
      <th style="width: 120px;">รหัสครุภัณฑ์ (PID)</th>
      <th>ชื่อครุภัณฑ์ / ยี่ห้อ-รุ่น</th>
      <th class="center" style="width: 105px;">หมายเลขเครื่อง (S/N)</th>
      <th style="width: 130px;">หน่วยงานที่รับผิดชอบ</th>
      <th class="center" style="width: 95px;">วันที่รับ / ประกัน</th>
      <th class="center" style="width: 90px;">สถานะ</th>
      <th class="number" style="width: 85px;">ราคา (บ.)</th>
    </tr>`;

    tableRowsHtml = assets.length
      ? assets
          .map((a, idx) => {
            const pid = a.noid || a.id;
            const brandModel = [a.model, a.company?.name].filter(Boolean).join(" / ");
            return `<tr>
              <td class="center">${idx + 1}</td>
              <td style="font-family: monospace; font-weight: 600;">${escapeHtml(pid)}</td>
              <td>
                <strong>${escapeHtml(a.name || "-")}</strong>
                ${brandModel ? `<small>ยี่ห้อ/รุ่น: ${escapeHtml(brandModel)}</small>` : ""}
              </td>
              <td class="center">${escapeHtml(a.serialNo || "-")}</td>
              <td>${escapeHtml(a.section?.name || "ครุภัณฑ์ส่วนกลาง")}</td>
              <td class="center" style="white-space: nowrap;">
                <div>${formatDate(a.receivedDate)}</div>
                ${getWarrantyHtml(a.warrantyDate)}
              </td>
              <td class="center">${getBadgeHtml(a.status?.name, a.status?.code)}</td>
              <td class="number">${a.price ? money(a.price) : "-"}</td>
            </tr>`;
          })
          .join("")
      : `<tr><td colspan="8" class="empty">ไม่พบรายการครุภัณฑ์ตามเงื่อนไขที่เลือก</td></tr>`;
  }

  const totalAmount = assets.reduce((sum, item) => sum + Number(item.price || 0), 0);

  let signaturesHtml = "";
  if (activeTab === "WAIT_DISPOSAL") {
    signaturesHtml = `
      <div class="signatures cols-3" style="margin-top: 20px;">
        ${signature("เจ้าหน้าที่พัสดุ (ผู้สำรวจ/รวบรวม)", context.preparedBy)}
        ${signature("หัวหน้างานพัสดุและบำรุงรักษา (ผู้ตรวจสอบ)")}
        ${signature("ผู้อำนวยการ / ผู้มีอำนาจสั่งการ (ผู้อนุมัติ)")}
      </div>
    `;
  } else if (activeTab === "DISPOSAL") {
    signaturesHtml = `
      <div class="signatures" style="margin-top: 20px;">
        ${signature("เจ้าหน้าที่พัสดุ (ผู้ตัดจำหน่าย)", context.preparedBy)}
        ${signature("หัวหน้างานพัสดุและบำรุงรักษา (ผู้รับรอง)")}
      </div>
    `;
  } else {
    signaturesHtml = `
      <div class="signatures" style="margin-top: 20px;">
        ${signature("เจ้าหน้าที่พัสดุ (ผู้จัดทำรายงาน)", context.preparedBy)}
        ${signature("หัวหน้างานพัสดุและบำรุงรักษา (ผู้ตรวจสอบ)")}
      </div>
    `;
  }

  const body = `
    <header class="document-header">
      <div class="brand-mark">H</div>
      <div class="brand-copy">
        <p>โรงพยาบาลและหน่วยงานในสังกัด</p>
        <h1>${escapeHtml(title)}</h1>
        <span>${escapeHtml(subtitle)}</span>
      </div>
      <div class="document-ref">
        <span>เลขที่อ้างอิง</span>
        <strong>${escapeHtml(refCode)}</strong>
      </div>
    </header>

    ${filterBarHtml}
    ${summaryHtml}

    <section class="table-section">
      <h2>รายการครุภัณฑ์ (${assets.length} รายการ)</h2>
      <table>
        <thead>
          ${tableHeaderHtml}
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>
    </section>

    <div class="report-summary-signatures" style="break-inside: avoid; page-break-inside: avoid; margin-top: 24px;">
      ${
        assets.length > 0 && totalAmount > 0
          ? `<section style="margin: 0 0 24px 0; padding: 12px; border: 2px solid #059669; border-radius: 8px; background: #ecfdf5; display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 13px; font-weight: 700; color: #065f46;">มูลค่ารวมครุภัณฑ์ทั้งหมด (${assets.length.toLocaleString()} รายการ)</span>
              <strong style="font-size: 16px; color: #047857;">${money(totalAmount)} บาท</strong>
            </section>`
          : ""
      }

      ${signaturesHtml}
    </div>
  `;

  return openPrintWindow(
    title,
    documentShell(title, body, context.preparedBy, context.preparedAt || new Date()),
  );
}

// -------------------------------------------------------------
// Report 5: รายงานทะเบียนคุมครุภัณฑ์พัสดุแยกตามประเภท (Grouped by Asset Type)
// -------------------------------------------------------------
export interface EquipmentGroupedByTypePrintRequest {
  title?: string;
  subtitle?: string;
  reportRef?: string;
  assets: Asset[];
  context: {
    preparedBy: string;
    preparedAt?: Date;
  };
}

export type EquipmentGroupedByStatusPrintRequest = EquipmentGroupedByTypePrintRequest;

export function printEquipmentStockGroupedByTypeReport(
  request: EquipmentGroupedByTypePrintRequest,
): boolean {
  const {
    title = "รายงานทะเบียนคุมครุภัณฑ์แยกตามประเภท (งานพัสดุ)",
    subtitle = "ฝ่ายพัสดุและบำรุงรักษา • สรุปรายการตามหมวดหมู่ประเภทครุภัณฑ์และมูลค่างบประมาณ",
    reportRef,
    assets,
    context,
  } = request;

  const refCode =
    reportRef ||
    `PCL-TYP-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;

  interface TypeGroup {
    typeId: string;
    typeName: string;
    assets: Asset[];
    totalCost: number;
    normalCount: number;
    repairCount: number;
    disposalCount: number;
  }

  const groupMap = new Map<string, TypeGroup>();

  for (const asset of assets) {
    const typeId = String(asset.type?.id || asset.equipmentType?.id || "NO_TYPE");
    const typeName = asset.type?.name || asset.equipmentType?.name || "ไม่ระบุประเภทครุภัณฑ์";

    if (!groupMap.has(typeId)) {
      groupMap.set(typeId, {
        typeId,
        typeName,
        assets: [],
        totalCost: 0,
        normalCount: 0,
        repairCount: 0,
        disposalCount: 0,
      });
    }

    const group = groupMap.get(typeId)!;
    group.assets.push(asset);
    group.totalCost += Number(asset.price || 0);

    const code = (asset.status?.code || "").toUpperCase();
    if (code === "NORMAL") group.normalCount += 1;
    else if (code === "DAMAGED" || code === "UNDER_REPAIR") group.repairCount += 1;
    else if (
      code === "WAIT_DISPOSAL" ||
      code === "DISPOSAL" ||
      code === "DISPOSED" ||
      code === "LOST"
    ) {
      group.disposalCount += 1;
    }
  }

  const sortedGroups = Array.from(groupMap.values()).sort((a, b) =>
    a.typeName.localeCompare(b.typeName, "th"),
  );

  const totalAssetsCount = assets.length;
  const totalNormalCount = assets.filter((a) => a.status?.code === "NORMAL").length;
  const totalRepairCount = assets.filter(
    (a) => a.status?.code === "DAMAGED" || a.status?.code === "UNDER_REPAIR",
  ).length;
  const totalDisposalCount = assets.filter(
    (a) =>
      a.status?.code === "WAIT_DISPOSAL" ||
      a.status?.code === "DISPOSAL" ||
      a.status?.code === "DISPOSED" ||
      a.status?.code === "LOST",
  ).length;
  const totalAmount = assets.reduce(
    (sum, item) => sum + Number(item.price || 0),
    0,
  );

  const typeBlocksHtml = sortedGroups
    .map((grp, gIdx) => {
      const rows = grp.assets
        .map((a, rIdx) => {
          const pid = a.noid || a.id;
          const brandModel = [a.model, a.company?.name].filter(Boolean).join(" / ");
          return `<tr>
            <td class="center">${rIdx + 1}</td>
            <td style="font-family: monospace; font-weight: 600;">${escapeHtml(pid)}</td>
            <td>
              <strong>${escapeHtml(a.name || "-")}</strong>
              ${brandModel ? `<small>ยี่ห้อ/รุ่น: ${escapeHtml(brandModel)}</small>` : ""}
            </td>
            <td class="center">${escapeHtml(a.serialNo || "-")}</td>
            <td>${escapeHtml(a.section?.name || "ครุภัณฑ์ส่วนกลาง")}</td>
            <td class="center" style="white-space: nowrap;">
              <div>${formatDate(a.receivedDate)}</div>
              ${getWarrantyHtml(a.warrantyDate)}
            </td>
            <td class="center">${getBadgeHtml(a.status?.name, a.status?.code)}</td>
            <td class="number">${a.price ? money(a.price) : "-"}</td>
          </tr>`;
        })
        .join("");

      return `
        <div class="department-block">
          <div class="department-header-bar">
            <div>
              <h3>หมวดที่ ${gIdx + 1}: ${escapeHtml(grp.typeName)}</h3>
            </div>
            <div class="dept-badges">
              <span class="dept-badge">รวม: <strong>${grp.assets.length}</strong></span>
              <span class="dept-badge" style="color: #047857;">พร้อมใช้: <strong>${grp.normalCount}</strong></span>
              ${grp.repairCount > 0 ? `<span class="dept-badge" style="color: #b45309;">ซ่อม: <strong>${grp.repairCount}</strong></span>` : ""}
              ${grp.disposalCount > 0 ? `<span class="dept-badge" style="color: #475569;">รอ/จำหน่าย: <strong>${grp.disposalCount}</strong></span>` : ""}
              <span class="dept-badge" style="color: #047857;">มูลค่า: <strong>${money(grp.totalCost)}</strong> บ.</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th class="center" style="width: 35px;">ลำดับ</th>
                <th style="width: 120px;">รหัสครุภัณฑ์ (PID)</th>
                <th>ชื่อครุภัณฑ์ / ยี่ห้อ-รุ่น</th>
                <th class="center" style="width: 105px;">หมายเลขเครื่อง (S/N)</th>
                <th style="width: 130px;">หน่วยงานที่รับผิดชอบ</th>
                <th class="center" style="width: 95px;">วันที่รับ / ประกัน</th>
                <th class="center" style="width: 85px;">สถานะ</th>
                <th class="number" style="width: 90px;">ราคา (บาท)</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
              ${
                grp.totalCost > 0
                  ? `<tr style="background: #f8fafc; font-weight: 700; break-inside: avoid; page-break-inside: avoid;">
                      <td colspan="7" style="text-align: right; padding-right: 12px;">รวมหมวด ${escapeHtml(grp.typeName)} (${grp.assets.length} รายการ)</td>
                      <td class="number" style="color: #047857;">${money(grp.totalCost)}</td>
                    </tr>`
                  : ""
              }
            </tbody>
          </table>
        </div>
      `;
    })
    .join("");

  const body = `
    <header class="document-header">
      <div class="brand-mark">H</div>
      <div class="brand-copy">
        <p>โรงพยาบาลและหน่วยงานในสังกัด</p>
        <h1>${escapeHtml(title)}</h1>
        <span>${escapeHtml(subtitle)} (ครอบคลุม ${sortedGroups.length} หมวด)</span>
      </div>
      <div class="document-ref">
        <span>เลขที่อ้างอิง</span>
        <strong>${escapeHtml(refCode)}</strong>
      </div>
    </header>

    <div style="font-size: 11px; color: #475569; margin-bottom: 8px;">
      ข้อมูลทะเบียนคุมครุภัณฑ์ทั้งหมด (ครอบคลุมทั้งหมด <strong>${sortedGroups.length.toLocaleString()}</strong> หมวดประเภทครุภัณฑ์)
    </div>

    <div class="summary-grid" style="grid-template-columns: repeat(4, 1fr); margin-bottom: 16px;">
      <div>
        <span>ครุภัณฑ์รวมทั้งหมด</span>
        <strong>${totalAssetsCount.toLocaleString()}</strong>
        <small>รายการ</small>
      </div>
      <div>
        <span>พร้อมใช้งาน</span>
        <strong style="color: #047857;">${totalNormalCount.toLocaleString()}</strong>
        <small>รายการ</small>
      </div>
      <div>
        <span>ชำรุด / ส่งซ่อม</span>
        <strong style="color: #b45309;">${totalRepairCount.toLocaleString()}</strong>
        <small>รายการ</small>
      </div>
      <div>
        <span>รอจำหน่าย / จำหน่ายแล้ว / สูญหาย</span>
        <strong style="color: #475569;">${totalDisposalCount.toLocaleString()}</strong>
        <small>รายการ</small>
      </div>
    </div>

    ${typeBlocksHtml}

    <div class="report-summary-signatures" style="break-inside: avoid; page-break-inside: avoid; margin-top: 24px;">
      <section style="margin: 0 0 24px 0; padding: 12px; border: 2px solid #059669; border-radius: 8px; background: #ecfdf5; display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 13px; font-weight: 700; color: #065f46;">มูลค่ารวมครุภัณฑ์ทั้งหมดทุกประเภท (${totalAssetsCount.toLocaleString()} รายการ)</span>
        <strong style="font-size: 16px; color: #047857;">${money(totalAmount)} บาท</strong>
      </section>

      <div class="signatures" style="margin-top: 20px;">
        ${signature("เจ้าหน้าที่พัสดุ (ผู้จัดทำรายงาน)", context.preparedBy)}
        ${signature("หัวหน้างานพัสดุและบำรุงรักษา (ผู้ตรวจสอบ)")}
      </div>
    </div>
  `;

  return openPrintWindow(
    title,
    documentShell(title, body, context.preparedBy, context.preparedAt || new Date()),
  );
}

// Keep backward-compatible alias
export const printEquipmentStockGroupedByStatusReport = printEquipmentStockGroupedByTypeReport;

