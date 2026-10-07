import {
  ChevronDown,
  Search,
  ClipboardList,
  Clock,
  Wrench,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import TrackTable from "../components/track/TrackTable";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { getLookUp, getRepairsHistory } from "../services/trackingService";
import { getSections } from "../services/assetService";
import { useAuthStore } from "../stores/authStore";
import { ROLES } from "../router/roles";
import StatCards from "../components/borrow-return/StatCards";
import type { StatCardData } from "../components/borrow-return/StatCards";

// จัดกลุ่มสถานะงานซ่อม (job status code) สำหรับการ์ดสรุป
const STATUS_GROUPS = [
  {
    key: "PENDING",
    title: "รอดำเนินการ",
    codes: ["WAITING_HANDOVER", "PENDING_ASSIGN"],
    icon: Clock,
    iconBg: "bg-amber-50",
    iconColor: "text-amber-500",
    valueColor: "text-amber-600",
  },
  {
    key: "IN_PROGRESS",
    title: "กำลังซ่อม",
    codes: ["IN_PROGRESS", "WAITING_PARTS", "PARCEL_PROCESSING", "OUTSOURCED"],
    icon: Wrench,
    iconBg: "bg-blue-50",
    iconColor: "text-blue-500",
    valueColor: "text-blue-600",
  },
  {
    key: "DONE",
    title: "ซ่อมเสร็จสิ้น",
    codes: ["WAITING_DELIVERY", "COMPLETED"],
    icon: CheckCircle2,
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-500",
    valueColor: "text-emerald-600",
  },
  {
    key: "CLOSED",
    title: "ซ่อมไม่ได้ / ยกเลิก",
    codes: ["UNREPAIRABLE", "CANCELLED"],
    icon: XCircle,
    iconBg: "bg-rose-50",
    iconColor: "text-rose-500",
    valueColor: "text-rose-600",
  },
];

const findGroupKey = (code?: string) =>
  STATUS_GROUPS.find((g) => code && g.codes.includes(code))?.key ?? "ALL";

export default function TrackingAssetCenter({}) {
  // ดึงรายการสถานะทั้งหมดจาก /repairs/lookups/meta (ไม่ขึ้นกับว่ามีงานซ่อมอยู่หรือไม่)
  const { data: lookups } = useQuery({
    queryKey: ["repairsLookups"],
    queryFn: getLookUp,
  });
  const statusOptions = lookups?.jobStatuses ?? [];

  const user = useAuthStore((state) => state.user);
  const role = useAuthStore((state) => state.role);
  // ASSET_CENTER_STAFF เห็นทุกแผนกและกรองแผนกได้, DEPARTMENT_STAFF เห็นเฉพาะแผนกตัวเอง (กรองที่ backend)
  const canFilterSection = role === ROLES.ASSET_CENTER_STAFF;

  const { data: sections } = useQuery({
    queryKey: ["sections"],
    queryFn: getSections,
    enabled: canFilterSection,
  });

  const [inputSearch, setInputSearch] = useState("");
  const [statusCode, setStatusCode] = useState("ALL");
  const [statusLabel, setStatusLabel] = useState("ทั้งหมด");
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  const [sectionId, setSectionId] = useState("ALL");
  const [sectionLabel, setSectionLabel] = useState("ทั้งหมด");
  const [isSectionOpen, setIsSectionOpen] = useState(false);
  const sectionDropdownRef = useRef<HTMLDivElement>(null);

  // กลุ่มสถานะที่เลือกจากการ์ด ("ALL" = ไม่กรอง)
  const [statusGroup, setStatusGroup] = useState("ALL");

  const effectiveSectionId = canFilterSection ? sectionId : "ALL";

  // DEPARTMENT_STAFF ถูก backend จำกัดให้เห็นเฉพาะแผนกตัวเองอยู่แล้ว
  // แยก cache ตามผู้ใช้ เพื่อไม่ให้เห็นข้อมูลของบัญชีก่อนหน้าหลังสลับผู้ใช้
  const { data: repairsHistory } = useQuery({
    queryKey: ["repairsHistory", user?.id, effectiveSectionId],
    queryFn: () =>
      getRepairsHistory(
        effectiveSectionId !== "ALL" ? effectiveSectionId : undefined,
      ),
  });

  const statsSummary: StatCardData[] = useMemo(() => {
    const items = repairsHistory ?? [];
    const countGroup = (codes: string[]) =>
      items.filter((item) => codes.includes(item.jobStatus?.code ?? ""))
        .length;

    return [
      {
        id: "total",
        filterKey: "ALL",
        title: "งานซ่อมทั้งหมด",
        value: items.length,
        icon: ClipboardList,
        iconBg: "bg-slate-100",
        iconColor: "text-slate-600",
        valueColor: "text-slate-800",
      },
      ...STATUS_GROUPS.map((g) => ({
        id: g.key,
        filterKey: g.key,
        title: g.title,
        value: countGroup(g.codes),
        icon: g.icon,
        iconBg: g.iconBg,
        iconColor: g.iconColor,
        valueColor: g.valueColor,
      })),
    ];
  }, [repairsHistory]);

  // สถานะที่ใช้กรองตาราง: dropdown (สถานะเดียว) มาก่อน ถ้าไม่ได้เลือกใช้กลุ่มจากการ์ด
  const statusCodes = useMemo(() => {
    if (statusCode !== "ALL") return [statusCode];
    if (statusGroup === "ALL") return null;
    return STATUS_GROUPS.find((g) => g.key === statusGroup)?.codes ?? null;
  }, [statusCode, statusGroup]);

  const handleSelectCard = (key: string) => {
    setStatusGroup(key);
    setStatusCode("ALL");
    setStatusLabel("ทั้งหมด");
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        statusDropdownRef.current &&
        !statusDropdownRef.current.contains(event.target as Node)
      ) {
        setIsStatusOpen(false);
      }
      if (
        sectionDropdownRef.current &&
        !sectionDropdownRef.current.contains(event.target as Node)
      ) {
        setIsSectionOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    // 1. เปลี่ยนให้หน้าเพจนี้ใช้ความสูงเต็มพื้นที่ (h-full) และเรียงลงมา (flex-col)
    // เพิ่มระยะห่างระหว่างส่วนค้นหากับตารางให้โปร่งขึ้น
    <div className="flex flex-col h-full space-y-4 md:space-y-6">
      {/* การ์ดสรุปสถานะงานซ่อม (กดเพื่อกรองตาราง) */}
      <div className="shrink-0">
        <StatCards
          stats={statsSummary}
          selectedCategory={statusGroup}
          onSelectCategory={handleSelectCard}
        />
      </div>

      {/* Search & Filter Bar */}
      {/* 2. ทำให้รองรับจอเล็ก (Responsive) จัดเรียงบน-ล่างในจอมือถือ และเรียงซ้าย-ขวาในจอใหญ่ */}
      <div className="shrink-0 flex flex-col md:flex-row flex-wrap items-start md:items-center gap-4 bg-bg-component shadow-sm w-full rounded-lg p-4">
        {/* กรอกคำค้นหา */}
        <div className="relative flex-1 w-full md:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหา ..."
            onChange={(e) => setInputSearch(e.target.value)}
            value={inputSearch}
            // ปรับความสูงเป็น h-10 และทำขอบ rounded-lg ให้เข้ากัน
            className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 transition-all"
          />
        </div>

        {/* Dropdown สถานะ */}
        <div className="w-full md:w-auto relative" ref={statusDropdownRef}>
          <button
            type="button"
            onClick={() => setIsStatusOpen((prev) => !prev)}
            className="relative flex items-center justify-between md:justify-start h-10 px-4 rounded-lg border border-slate-200 bg-white text-sm hover:border-slate-300 transition-colors cursor-pointer w-full md:w-auto"
          >
            <div className="flex items-center">
              <span className="text-slate-600 mr-1.5 whitespace-nowrap">
                สถานะ:
              </span>
              {/* ป้องกันชื่อสถานะยาวเกินไปแล้วทำให้ UI พังด้วย truncate */}
              <span className="font-semibold text-emerald-600 whitespace-nowrap truncate max-w-[150px]">
                {statusLabel}
              </span>
            </div>
            <ChevronDown
              className={`h-4 w-4 text-slate-400 ml-3 shrink-0 transition-transform ${
                isStatusOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {isStatusOpen && (
            <div className="absolute z-20 mt-1 w-full md:min-w-[180px] rounded-lg border border-slate-200 bg-white shadow-lg py-1 max-h-60 overflow-auto">
              <button
                type="button"
                onClick={() => {
                  setStatusCode("ALL");
                  setStatusLabel("ทั้งหมด");
                  setStatusGroup("ALL");
                  setIsStatusOpen(false);
                }}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition-colors ${
                  statusCode === "ALL"
                    ? "font-semibold text-emerald-600"
                    : "text-slate-700"
                }`}
              >
                ทั้งหมด
              </button>
              {statusOptions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setStatusCode(item.code);
                    setStatusLabel(item.name);
                    setStatusGroup(findGroupKey(item.code));
                    setIsStatusOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition-colors truncate ${
                    statusCode === item.code
                      ? "font-semibold text-emerald-600"
                      : "text-slate-700"
                  }`}
                >
                  {item.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Dropdown แผนก (เฉพาะ ASSET_CENTER_STAFF) */}
        {canFilterSection && (
          <div className="w-full md:w-auto relative" ref={sectionDropdownRef}>
            <button
              type="button"
              onClick={() => setIsSectionOpen((prev) => !prev)}
              className="relative flex items-center justify-between md:justify-start h-10 px-4 rounded-lg border border-slate-200 bg-white text-sm hover:border-slate-300 transition-colors cursor-pointer w-full md:w-auto"
            >
              <div className="flex items-center">
                <span className="text-slate-600 mr-1.5 whitespace-nowrap">
                  แผนก:
                </span>
                <span className="font-semibold text-emerald-600 whitespace-nowrap truncate max-w-[150px]">
                  {sectionLabel}
                </span>
              </div>
              <ChevronDown
                className={`h-4 w-4 text-slate-400 ml-3 shrink-0 transition-transform ${
                  isSectionOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {isSectionOpen && (
              <div className="absolute z-20 mt-1 w-full md:min-w-[200px] rounded-lg border border-slate-200 bg-white shadow-lg py-1 max-h-60 overflow-auto">
                <button
                  type="button"
                  onClick={() => {
                    setSectionId("ALL");
                    setSectionLabel("ทั้งหมด");
                    setIsSectionOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition-colors ${
                    sectionId === "ALL"
                      ? "font-semibold text-emerald-600"
                      : "text-slate-700"
                  }`}
                >
                  ทั้งหมด
                </button>
                {sections?.map((sec) => (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => {
                      setSectionId(sec.id);
                      setSectionLabel(sec.name);
                      setIsSectionOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition-colors truncate ${
                      sectionId === sec.id
                        ? "font-semibold text-emerald-600"
                        : "text-slate-700"
                    }`}
                  >
                    {sec.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      {/* 3. ดันตารางให้กินพื้นที่ที่เหลือทั้งหมด (flex-1) พร้อมกับบังคับให้ Scroll เกิดเฉพาะในกล่องนี้ (overflow-hidden) */}
      <div className="flex-1 overflow-hidden min-h-[420px]">
        <TrackTable
          items={repairsHistory}
          inputSearch={inputSearch}
          statusCodes={statusCodes}
        />
      </div>
    </div>
  );
}
