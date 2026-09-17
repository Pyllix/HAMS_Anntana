import React, { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";

interface CalendarFilterDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date | null;
  onSelectDate: (date: Date | null, label?: string) => void;
}

const THAI_MONTHS_FULL = [
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

const WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

export default function CalendarFilterDialog({
  isOpen,
  onClose,
  selectedDate,
  onSelectDate,
}: CalendarFilterDialogProps) {
  const [currentMonth, setCurrentMonth] = useState(
    selectedDate ? selectedDate.getMonth() : new Date().getMonth()
  );
  const [currentYear, setCurrentYear] = useState(
    selectedDate ? selectedDate.getFullYear() : new Date().getFullYear()
  );
  const [tempSelectedDate, setTempSelectedDate] = useState<Date | null>(
    selectedDate
  );

  useEffect(() => {
    if (isOpen) {
      setCurrentMonth(
        selectedDate ? selectedDate.getMonth() : new Date().getMonth()
      );
      setCurrentYear(
        selectedDate ? selectedDate.getFullYear() : new Date().getFullYear()
      );
      setTempSelectedDate(selectedDate);
    }
  }, [isOpen, selectedDate]);

  if (!isOpen) return null;

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayWeekday = new Date(currentYear, currentMonth, 1).getDay();

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleConfirm = () => {
    if (tempSelectedDate) {
      const d = tempSelectedDate;
      const label = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() + 543}`;
      onSelectDate(tempSelectedDate, label);
    } else {
      onSelectDate(null, "ทั้งหมด");
    }
    onClose();
  };

  const isSameDay = (d1: Date | null, year: number, month: number, day: number) => {
    if (!d1) return false;
    return (
      d1.getFullYear() === year &&
      d1.getMonth() === month &&
      d1.getDate() === day
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-2xs p-4"
      onClick={onClose}
    >
      <div
        className="w-72 bg-white rounded-2xl shadow-2xl p-4 space-y-3 animate-in fade-in zoom-in-95 border border-slate-100 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Month & Year Navigation */}
        <div className="flex items-center justify-between px-1">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="text-xs font-bold text-slate-800">
            {THAI_MONTHS_FULL[currentMonth]} {currentYear + 543}
          </div>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Weekday Labels */}
        <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-slate-400">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-1">
              {w}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {Array.from({ length: firstDayWeekday }, (_, i) => (
            <div key={`empty-${i}`} className="h-7 w-7" />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const dayNum = i + 1;
            const isSelected = isSameDay(
              tempSelectedDate,
              currentYear,
              currentMonth,
              dayNum
            );
            return (
              <button
                key={dayNum}
                type="button"
                onClick={() =>
                  setTempSelectedDate(
                    new Date(currentYear, currentMonth, dayNum)
                  )
                }
                className={`h-7 w-7 rounded-full flex items-center justify-center font-semibold text-xs transition-colors cursor-pointer mx-auto ${
                  isSelected
                    ? "bg-orange-600 text-white shadow-xs font-bold"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {dayNum}
              </button>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs gap-1">
          <button
            type="button"
            onClick={() => {
              onSelectDate(null, "เดือนนี้");
              onClose();
            }}
            className="px-2 py-1 rounded-lg text-orange-600 hover:bg-orange-50 font-semibold cursor-pointer transition-colors"
          >
            เดือนนี้
          </button>
          <button
            type="button"
            onClick={() => {
              onSelectDate(null, "ทั้งหมด");
              onClose();
            }}
            className="px-2 py-1 rounded-lg text-slate-500 hover:bg-slate-100 font-medium cursor-pointer transition-colors"
          >
            ทั้งหมด
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-3.5 py-1 rounded-lg bg-orange-600 text-white hover:bg-orange-700 font-bold cursor-pointer transition-colors shadow-2xs"
          >
            ตกลง
          </button>
        </div>
      </div>
    </div>
  );
}
