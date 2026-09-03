import React, { useState, useRef, useEffect } from "react";
import { Search, X, Plus, Check } from "lucide-react";
import type { Mechanic } from "../../Types/TypeAssessment";

export interface MechanicSelectorProps {
  usersList: Mechanic[];
  selectedMechanicIds: (string | number)[];
  onToggleMechanic: (id: string) => void;
}

export default function MechanicSelector({
  usersList = [],
  selectedMechanicIds = [],
  onToggleMechanic,
}: MechanicSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mechanicSearch, setMechanicSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ปิด Dropdown เมื่อคลิกพื้นที่ภายนอก
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getUserId = (user: Mechanic | string | number): string => {
    if (!user) return "";
    if (typeof user === "string" || typeof user === "number")
      return String(user);
    return user.id ? String(user.id) : "";
  };

  const getUserFirstName = (user: Mechanic): string => {
    return user.firstname || user.userName || "Unknown";
  };

  const getUserInitials = (user: Mechanic): string => {
    return getUserFirstName(user).substring(0, 2).toUpperCase();
  };

  const cleanSelectedIds = Array.from(
    new Set(
      (selectedMechanicIds || [])
        .map((item) => getUserId(item))
        .filter((id) => id !== ""),
    ),
  );

  const safeUsersList = Array.isArray(usersList) ? usersList : [];

  const selectedMechanics = safeUsersList.filter((u) => {
    const userId = getUserId(u);
    return cleanSelectedIds.includes(userId);
  });

  // กรอง Role เฉพาะช่าง + ค้นหาข้อมูล
  const filteredMechanics = safeUsersList
    .filter((u) => {
      const userRole = String(u.role || "");
      return userRole === "MAINTENANCE_STAFF" || userRole === "technician";
    })
    .filter((u) => {
      const search = mechanicSearch.toLowerCase();
      const fullName = `${u.firstname || ""} ${u.lastname || ""}`.toLowerCase();
      const username = (u.userName || "").toLowerCase();

      return fullName.includes(search) || username.includes(search);
    });

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="text-xs font-semibold text-slate-700 block mb-1">
        ผู้รับผิดชอบงาน / ผู้ปฏิบัติงาน (Assignees){" "}
        <span className="text-rose-500">*</span>
        <span className="text-[11px] font-normal text-slate-400 ml-1">
          เลือกได้มากกว่า 1 คน (เลือกแล้ว {selectedMechanics.length} คน)
        </span>
      </label>

      {/* Chip ผู้รับผิดชอบงานที่เลือก */}
      <div className="min-h-[42px] p-1.5 border border-slate-200 focus-within:border-emerald-500 rounded-xl bg-white flex flex-wrap items-center gap-1.5 transition-colors">
        {selectedMechanics.map((m) => {
          const mId = getUserId(m);
          return (
            <div
              key={mId}
              className="inline-flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-full pl-1 pr-2 py-0.5"
            >
              <span className="h-5 w-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold">
                {getUserInitials(m)}
              </span>
              <span className="text-xs text-slate-700 font-medium">
                {getUserFirstName(m)}
              </span>
              <button
                type="button"
                onClick={() => onToggleMechanic(mId)}
                className="text-slate-400 hover:text-rose-500 cursor-pointer transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-1 text-xs text-slate-500 border border-dashed border-slate-300 rounded-full px-3 py-1 hover:border-emerald-500 hover:text-emerald-600 transition-colors cursor-pointer ml-auto"
        >
          <Plus className="h-3.5 w-3.5" />
          เพิ่มผู้รับผิดชอบ...
        </button>
      </div>

      {/* Dropdown ตัวเลือกรายชื่อ */}
      {isOpen && (
        <div className="absolute z-20 left-0 right-0 mt-2 bg-white border border-slate-100 shadow-xl rounded-xl p-3 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาชื่อช่าง, ตำแหน่ง หรือรหัสพนักงาน..."
              value={mechanicSearch}
              onChange={(e) => setMechanicSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="max-h-48 overflow-y-auto divide-y divide-slate-50">
            {filteredMechanics.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-400">
                ไม่พบรายชื่อช่าง
              </div>
            ) : (
              filteredMechanics.map((u) => {
                const uId = getUserId(u);
                const isSelected = cleanSelectedIds.includes(uId);

                return (
                  <div
                    key={uId}
                    onClick={() => onToggleMechanic(uId)}
                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                      isSelected ? "bg-emerald-50/50" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`h-4 w-4 rounded-md border flex items-center justify-center transition-colors ${
                          isSelected
                            ? "bg-emerald-600 border-emerald-600 text-white"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>
                      <span className="h-7 w-7 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">
                        {getUserInitials(u)}
                      </span>
                      <div>
                        <div className="text-xs font-semibold text-slate-800">
                          {getUserFirstName(u)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {u.userName} {u.lastname ? `• ${u.lastname}` : ""}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
