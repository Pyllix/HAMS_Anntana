import { Building2, Truck } from "lucide-react";
import {
  DELIVERY_METHOD_LABELS,
  type DeliveryMethod,
} from "../../services/borrowService";

export default function DeliveryMethodBadge({ method }: { method: string }) {
  if (method !== "PICKUP" && method !== "DELIVERY") {
    return <span className="text-sm text-gray-400">-</span>;
  }

  const isDelivery = method === "DELIVERY";
  const Icon = isDelivery ? Truck : Building2;

  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${
        isDelivery
          ? "bg-violet-50 text-violet-700"
          : "bg-slate-100 text-slate-700"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {DELIVERY_METHOD_LABELS[method as DeliveryMethod]}
    </span>
  );
}
