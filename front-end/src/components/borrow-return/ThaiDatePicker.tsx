import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const THAI_MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

const THAI_WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

const BUDDHIST_YEAR_OFFSET = 543;
const POPOVER_WIDTH = 288; // w-72
const VIEWPORT_MARGIN = 8;

// คำนวณความสูงจริงของปฏิทินตามจำนวนแถวของเดือนนั้น ๆ (4-6 แถว) แทนการเดาความสูงคงที่
// เพราะเดาสูงเกินจริงจะทำให้ popover พลิกขึ้นไปลอยด้านบนโดยไม่จำเป็นทั้งที่ด้านล่างมีที่ว่างพอ
function getEstimatedPopoverHeight(viewDate: Date): number {
  const firstDayOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const daysInMonth = new Date(
    viewDate.getFullYear(),
    viewDate.getMonth() + 1,
    0,
  ).getDate();
  const totalCells = firstDayOfMonth.getDay() + daysInMonth;
  const rowCount = Math.ceil(totalCells / 7);

  const padding = 24; // p-3 บน+ล่าง
  const headerRow = 36; // ปุ่มเดือน/ปี + mb-2
  const weekdayRow = 28; // แถวหัววัน + mb-1
  const dayGrid = rowCount * 28 + (rowCount - 1) * 4; // h-7 ต่อแถว + gap-1

  return padding + headerRow + weekdayRow + dayGrid;
}

// แปลง Date -> string รูปแบบ YYYY-MM-DD (ใช้ local time ไม่ใช่ UTC กัน timezone เพี้ยน)
function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// แปลง string YYYY-MM-DD -> Date (local time)
function parseDateString(value?: string): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

interface ThaiDatePickerProps {
  value?: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  minDate?: string; // YYYY-MM-DD, วันที่เลือกย้อนหลังกว่านี้ไม่ได้
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}

export default function ThaiDatePicker({
  value,
  onChange,
  minDate,
  placeholder = "เลือกวันที่",
  disabled = false,
  id,
}: ThaiDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedDate = parseDateString(value);
  const minDateObj = parseDateString(minDate);
  const [viewDate, setViewDate] = useState(selectedDate ?? new Date());
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  // ตำแหน่งของปฏิทิน (fixed, คำนวณจากตำแหน่งปุ่ม) เพื่อไม่ให้ container ที่ scroll ได้
  // ของ Dialog (overflow-y-auto) บัง/ตัดปฏิทินจนมองไม่เห็น
  const [popoverStyle, setPopoverStyle] = useState<{
    top: number;
    left: number;
  } | null>(null);

  // คำนวณตำแหน่ง popover ให้ลอยอยู่ใต้ปุ่ม (หรือด้านบนถ้าที่ว่างด้านล่างไม่พอ)
  const updatePosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();

    const estimatedHeight = getEstimatedPopoverHeight(viewDate);
    const spaceBelow = window.innerHeight - rect.bottom;
    const openAbove =
      spaceBelow < estimatedHeight + VIEWPORT_MARGIN && rect.top > spaceBelow;

    const top = openAbove
      ? Math.max(VIEWPORT_MARGIN, rect.top - estimatedHeight - 6)
      : rect.bottom + 6;

    let left = rect.left;
    const maxLeft = window.innerWidth - POPOVER_WIDTH - VIEWPORT_MARGIN;
    left = Math.min(Math.max(VIEWPORT_MARGIN, left), Math.max(VIEWPORT_MARGIN, maxLeft));

    setPopoverStyle({ top, left });
  };

  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePosition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, viewDate]);

  // อัปเดตตำแหน่งเมื่อ scroll (รวม scroll ของ container ข้างในเช่นตัว Dialog เอง)
  // หรือ resize จอ กัน popover หลุดตำแหน่งปุ่ม
  useEffect(() => {
    if (!isOpen) return;
    const handleReposition = () => updatePosition();
    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);
    return () => {
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
    };
  }, [isOpen]);

  // ปิด popup เมื่อคลิกข้างนอก (เช็คทั้งปุ่ม trigger และตัว popover ที่ portal ออกไป)
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const openPicker = () => {
    if (disabled) return;
    setViewDate(selectedDate ?? new Date());
    setIsOpen((prev) => !prev);
  };

  const goToPrevMonth = () => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleSelectDay = (day: number) => {
    const picked = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    onChange(toDateString(picked));
    setIsOpen(false);
  };

  // สร้างตารางวันของเดือนที่กำลังแสดง (เติมช่องว่างก่อนวันที่ 1 ตามวันในสัปดาห์)
  const firstDayOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const daysInMonth = new Date(
    viewDate.getFullYear(),
    viewDate.getMonth() + 1,
    0,
  ).getDate();
  const leadingBlanks = firstDayOfMonth.getDay();
  const dayCells: Array<number | null> = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const today = new Date();
  const displayText = selectedDate
    ? `${selectedDate.getDate()} ${THAI_MONTHS[selectedDate.getMonth()]} ${
        selectedDate.getFullYear() + BUDDHIST_YEAR_OFFSET
      }`
    : "";

  return (
    <>
      <button
        type="button"
        id={id}
        ref={triggerRef}
        disabled={disabled}
        onClick={openPicker}
        className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-left ${
          disabled
            ? "bg-gray-50/70 text-gray-400 cursor-not-allowed"
            : "bg-white text-gray-800 hover:border-gray-400"
        }`}
      >
        <span className={displayText ? "text-gray-800" : "text-gray-400"}>
          {displayText || placeholder}
        </span>
        <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
      </button>

      {isOpen &&
        popoverStyle &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: "fixed",
              top: popoverStyle.top,
              left: popoverStyle.left,
              width: POPOVER_WIDTH,
            }}
            className="z-[10000] bg-white border border-gray-200 rounded-xl shadow-lg p-3"
          >
            {/* Header เดือน/ปี พ.ศ. */}
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={goToPrevMonth}
                className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-emerald-600 transition-colors"
                aria-label="เดือนก่อนหน้า"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-semibold text-gray-800">
                {THAI_MONTHS[viewDate.getMonth()]}{" "}
                {viewDate.getFullYear() + BUDDHIST_YEAR_OFFSET}
              </span>
              <button
                type="button"
                onClick={goToNextMonth}
                className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-emerald-600 transition-colors"
                aria-label="เดือนถัดไป"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* หัววันในสัปดาห์ */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {THAI_WEEKDAYS.map((wd) => (
                <div
                  key={wd}
                  className="text-center text-[10px] font-medium text-gray-400 py-1"
                >
                  {wd}
                </div>
              ))}
            </div>

            {/* ตารางวัน */}
            <div className="grid grid-cols-7 gap-1">
              {dayCells.map((day, idx) => {
                if (day === null) return <div key={`blank-${idx}`} />;

                const cellDate = new Date(
                  viewDate.getFullYear(),
                  viewDate.getMonth(),
                  day,
                );
                const isSelected = selectedDate
                  ? isSameDay(cellDate, selectedDate)
                  : false;
                const isToday = isSameDay(cellDate, today);
                const isDisabled = minDateObj
                  ? cellDate <
                    new Date(
                      minDateObj.getFullYear(),
                      minDateObj.getMonth(),
                      minDateObj.getDate(),
                    )
                  : false;

                return (
                  <button
                    key={day}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => handleSelectDay(day)}
                    className={`h-7 w-full rounded-md text-xs transition-colors ${
                      isSelected
                        ? "bg-emerald-600 text-white font-semibold"
                        : isDisabled
                          ? "text-gray-300 cursor-not-allowed"
                          : isToday
                            ? "border border-emerald-500 text-emerald-600 font-medium hover:bg-emerald-50"
                            : "text-gray-700 hover:bg-emerald-50 hover:text-emerald-700"
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
