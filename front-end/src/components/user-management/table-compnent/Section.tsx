import { useQuery } from "@tanstack/react-query";
import { getSectionById } from "../../../services/sectionService";

export default function Section({ sectionId }: { sectionId: string }) {
  const { data: section } = useQuery({
    queryKey: ["section", sectionId],
    queryFn: () => getSectionById(sectionId),
  });

  return <span className="text-sm text-slate-600">{section?.name || "-"}</span>;
}
