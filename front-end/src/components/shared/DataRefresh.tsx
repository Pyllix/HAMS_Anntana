import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { refreshQueryFamilies, type DataChange } from "../../services/queryRefreshPolicy";

export default function DataRefresh() {
  const client = useQueryClient();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const pending = new Set<string>();
    const refresh = (event: Event) => {
      const change = (event as CustomEvent<DataChange>).detail;
      for (const family of change.families) pending.add(family);
      clearTimeout(timer);
      timer = setTimeout(() => {
        const writes = new Set(pending);
        pending.clear();
        // Cancel and refresh affected reads, including reads started before a write.
        void refreshQueryFamilies(client, writes);
      }, 100);
    };
    window.addEventListener("hams:data-changed", refresh);
    return () => { clearTimeout(timer); window.removeEventListener("hams:data-changed", refresh); };
  }, [client]);
  return null;
}
