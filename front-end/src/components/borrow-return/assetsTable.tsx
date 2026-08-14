import { tableFeatures, useTable } from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import type { Asset } from "../../types/TypeAsset";
import { useQuery } from "@tanstack/react-query";
import { getAssets } from "../../services/assetService";
import { useMemo } from "react";
import { useBorrowModalStore } from "../../stores/useBorrowModalStore";

const features = tableFeatures({});

const columns: Array<ColumnDef<typeof features, Asset>> = [
  {
    accessorKey: "imageUrl",
    header: "รูปภาพ",
    cell: (info) => (
      <img
        src={(info.getValue() as string) || "/placeholder.png"}
        alt="Asset"
        className="h-10 w-10 rounded-md object-cover bg-gray-100 border border-gray-200"
      />
    ),
  },
  {
    id: "item_info",
    header: "รายการ / รหัส",
    cell: (info) => {
      const row = info.row.original;
      return (
        <div>
          <div className="font-semibold text-gray-900">{row.name}</div>
          <div className="text-sm text-gray-400 font-mono mt-0.5">
            {row.serialNo || row.model}
          </div>
        </div>
      );
    },
  },
  {
    id: "typeName",
    header: "ประเภท",
    accessorFn: (row) => row.type?.name,
    cell: (info) => (
      <span className="text-sm text-gray-600">
        {(info.getValue() as string) ?? "-"}
      </span>
    ),
  },
  {
    id: "borrower_section",
    header: "สถานที่เก็บ",
    cell: (info) => {
      const row = info.row.original;
      return (
        <div>
          <div className="text-xs text-gray-500">
            {row.section?.name ?? "-"}
          </div>
        </div>
      );
    },
  },
  //   {
  //     accessorKey: "receivedDate",
  //     header: "วันที่ยืม",
  //     cell: (info) => {
  //       const dateStr = info.getValue() as string;

  //       const timePart = dateStr.split("T")[0];
  //       return <span className="text-sm text-gray-600">{timePart || "-"}</span>;
  //     },
  //   },
  {
    id: "statusName",
    header: "สถานะ",
    cell: (info) => {
      const status = info.row.original.availabilityStatus;
      const code = status?.code;
      const name = status?.name ?? "-";

      // เลือก Class สีตาม Code
      const getStatusStyle = (statusCode?: string) => {
        switch (statusCode) {
          case "AVAILABLE":
            return "bg-emerald-100 text-emerald-700";
          case "BORROWED":
            return "bg-red-100 text-red-700";
          case "UNAVAILABLE":
          default:
            return "bg-gray-100 text-gray-700";
        }
      };

      return (
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium ${getStatusStyle(
            code,
          )}`}
        >
          {name}
        </span>
      );
    },
  },
  {
    id: "actions",
    header: "จัดการ",
    cell: (info) => {
      const row = info.row.original;
      const isAvailable = info.row.original.availabilityStatus?.code;

      const handleOpenModal = () => {
        useBorrowModalStore.getState().openForm(row);
        console.log(useBorrowModalStore.getState().isFormOpen);
        console.log(row);
      };

      if (isAvailable === "AVAILABLE") {
        return (
          <button
            type="button"
            onClick={handleOpenModal}
            className="rounded-lg bg-emerald-600 max-w-20 w-full px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
          >
            {"ยืมของ"}
          </button>
        );
      }

      if (isAvailable === "BORROWED") {
        return (
          <button
            type="button"
            onClick={handleOpenModal}
            className="rounded-lg border border-emerald-600 max-w-20 w-full px-3 py-1.5 text-sm font-medium text-emerald-600 hover:bg-emerald-50 transition-colors"
          >
            {"รับคืน"}
          </button>
        );
      }

      if (isAvailable === "UNAVAILABLE") {
        return (
          <button
            disabled
            type="button"
            onClick={handleOpenModal}
            className="rounded-lg border border-emerald-600 max-w-20 w-full px-3 py-1.5 text-sm font-medium text-emerald-600 hover:bg-emerald-50 transition-colors"
          >
            {"ไม่พร้อม"}
          </button>
        );
      }
    },
  },
];

interface Props {
  search: string;
  category: string;
  type: string;
}

export default function AssetsTable({ search, category, type }: Props) {
  const { data: assets } = useQuery({
    queryKey: ["assets"],
    queryFn: getAssets,
  });

  const filteredAssets = useMemo(() => {
    if (!assets) {
      console.log("assets is undefined at AssetsTable.tsx");
      return [];
    }

    return assets.filter((item) => {
      const matchesSearch =
        search === "" ||
        item.name?.toLowerCase().includes(search.toLowerCase()) ||
        item.serialNo?.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        category === "ALL" || item.availabilityStatus?.name === category;

      const matchesType = type === "ALL" || item.type?.name === type;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [assets, search, category, type]);

  const table = useTable({
    key: "assets-table",
    features,
    columns,
    data: filteredAssets ?? [],
  });

  return (
    <table className="w-full text-left p-8">
      <thead className="font-bold text-md">
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id} className="border-b border-slate-200">
            {headerGroup.headers.map((header) => (
              <th key={header.id} className="py-3 px-4">
                {header.isPlaceholder ? null : (
                  <table.FlexRender header={header} />
                )}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody className="divide-y divide-slate-100">
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id}>
            {row.getAllCells().map((cell) => (
              <td key={cell.id} className="py-3 px-4">
                <table.FlexRender cell={cell} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
