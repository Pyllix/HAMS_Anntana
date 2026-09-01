import React, { useState, useEffect } from "react";
import { getCompanies } from "../../services/assessmentService";
import type { Company } from "../../Types/TypeAssessment";

interface ExternalVendorProps {
  vendorId: string;
  setVendorId: React.Dispatch<React.SetStateAction<string>>;
}

export const ExternalVendorFields: React.FC<ExternalVendorProps> = ({
  vendorId,
  setVendorId,
}) => {
  const [vendors, setVendors] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    const fetchVendors = async () => {
      try {
        setIsLoading(true);
        setErrorMsg("");

        const res = await getCompanies();
        const list: Company[] = Array.isArray(res)
          ? res
          : (res as { data?: Company[] })?.data || [];
        setVendors(list);
      } catch (err) {
        console.error("Failed to fetch companies/vendors:", err);
        setErrorMsg("ไม่สามารถดึงข้อมูลบริษัท");
      } finally {
        setIsLoading(false);
      }
    };

    fetchVendors();
  }, []);

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-slate-700 block">
        บริษัทที่ส่งซ่อม <span className="text-rose-500">*</span>
      </label>

      <div className="relative">
        <select
          value={vendorId}
          disabled={isLoading}
          onChange={(e) => setVendorId(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-emerald-500 bg-white disabled:bg-slate-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <option value="">
            {isLoading
              ? "-- กำลังโหลดข้อมูลบริษัทที่ส่งซ่อม... --"
              : "-- กรุณาเลือกบริษัทที่ส่งซ่อม --"}
          </option>

          {vendors.map((item) => {
            const codeDisplay = item.code ? ` (${item.code})` : "";

            return (
              <option key={item.id} value={item.id}>
                {item.name || "ไม่ระบุชื่อบริษัท"} {codeDisplay}
              </option>
            );
          })}
        </select>
      </div>

      {errorMsg && (
        <p className="text-[11px] text-rose-500 font-medium">{errorMsg}</p>
      )}
    </div>
  );
};

export default ExternalVendorFields;
