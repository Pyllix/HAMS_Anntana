import { useQuery } from "@tanstack/react-query";
import { Building2, Phone } from "lucide-react";
import { getSections } from "../../services/assetService";

// แสดงหน่วยงานและเบอร์โทรของผู้ยืม (ใช้เป็นที่อยู่นำส่งเมื่อเลือกให้เจ้าหน้าที่นำส่ง)
export default function BorrowerSectionInfo({
  sectionId,
}: {
  sectionId: string | null | undefined;
}) {
  // ใช้ queryKey เดียวกับหน้าอื่น ดึงครั้งเดียวแล้วแชร์ cache กันทุกแถว
  const { data: sections } = useQuery({
    queryKey: ["sections"],
    queryFn: getSections,
  });

  const section = sectionId
    ? sections?.find((s) => s.id === sectionId)
    : undefined;

  if (!section) return null;

  return (
    <div className="mt-1 flex flex-col gap-0.5 text-xs text-gray-500">
      <span className="flex items-center gap-1">
        <Building2 className="h-3 w-3 flex-shrink-0 text-gray-400" />
        {section.name || "-"}
        {section.building ? ` (${section.building})` : ""}
      </span>
      <span className="flex items-center gap-1">
        <Phone className="h-3 w-3 flex-shrink-0 text-gray-400" />
        {section.tel || "-"}
      </span>
    </div>
  );
}
