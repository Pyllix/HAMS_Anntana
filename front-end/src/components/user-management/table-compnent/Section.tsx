import { useQuery } from "@tanstack/react-query";
import { getSectionById } from "../../../services/sectionService";

export default function Section({ sectionId }: { sectionId: string | null | undefined }) {
  const { data: section } = useQuery({
    queryKey: ["section", sectionId],
    queryFn: () => getSectionById(sectionId!),
    enabled: !!sectionId,
  });

  return (
    <span className="text-sm text-slate-600">
      {sectionId ? section?.name || "-" : "ไม่ระบุหน่วยงาน"}
    </span>
  );
}
