import { useState, useMemo, useEffect } from "react";
import {
  Search,
  ChevronDown,
  Plus,
  Eye,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getCompanies,
  createCompany,
  updateCompany,
  deleteCompany,
} from "../services/companyService";
import type { Company } from "../Types/TypeCompany";
import {
  CompanyDetailModal,
  CompanyFormModal,
  CompanyDeleteModal,
} from "../components/company/CompanyModals";

export default function CompanySupplierPage() {
  const queryClient = useQueryClient();

  // Filter States
  const [inputSearch, setInputSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6; // Matching mockup display: "แสดง 1 ถึง 6 จาก ..."

  // Modal States
  const [detailItem, setDetailItem] = useState<Company | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const [formItem, setFormItem] = useState<Company | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const [deleteItem, setDeleteItem] = useState<Company | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(inputSearch);
      setCurrentPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [inputSearch]);

  // Query Companies
  const { data: companies = [], isLoading } = useQuery({
    queryKey: ["companies"],
    queryFn: getCompanies,
  });

  // Unique groups strictly from backend companies
  const availableGroups = useMemo(() => {
    const groupsSet = new Set<string>();
    companies.forEach((c) => {
      if (c.group && c.group.trim()) {
        groupsSet.add(c.group.trim());
      }
    });
    return Array.from(groupsSet);
  }, [companies]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: createCompany,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      setIsFormOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string | number; dto: any }) =>
      updateCompany(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      setIsFormOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCompany,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      setIsDeleteOpen(false);
    },
  });

  // Filter logic
  const filteredList = useMemo(() => {
    return companies.filter((item) => {
      const q = debouncedSearch.toLowerCase().trim();
      const code = String(item.code || "").toLowerCase();
      const name = String(item.name || "").toLowerCase();
      const tel = String(item.tel || "").toLowerCase();
      const group = String(item.group || "").toLowerCase();
      const id = String(item.id || "").toLowerCase();

      const matchesSearch =
        q === "" ||
        name.includes(q) ||
        code.includes(q) ||
        tel.includes(q) ||
        group.includes(q) ||
        id.includes(q);

      const matchesGroup =
        groupFilter === "ALL" ||
        item.group?.toLowerCase() === groupFilter.toLowerCase();

      const itemActive = !item.deletedAt && item.isActive !== false;
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && itemActive) ||
        (statusFilter === "INACTIVE" && !itemActive);

      return matchesSearch && matchesGroup && matchesStatus;
    });
  }, [companies, debouncedSearch, groupFilter, statusFilter]);

  // Pagination calculation
  const totalItems = filteredList.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredList.slice(start, start + pageSize);
  }, [filteredList, currentPage, pageSize]);

  // 3-button sliding window
  const visiblePages = useMemo(() => {
    if (totalPages <= 3) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (currentPage <= 2) {
      return [1, 2, 3];
    }
    if (currentPage >= totalPages - 1) {
      return [totalPages - 2, totalPages - 1, totalPages];
    }
    return [currentPage - 1, currentPage, currentPage + 1];
  }, [currentPage, totalPages]);

  // Handlers
  const handleOpenDetail = (item: Company) => {
    setDetailItem(item);
    setIsDetailOpen(true);
  };

  const handleOpenCreate = () => {
    setFormItem(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (item: Company) => {
    setFormItem(item);
    setIsFormOpen(true);
  };

  const handleOpenDelete = (item: Company) => {
    setDeleteItem(item);
    setIsDeleteOpen(true);
  };

  const handleFormSubmit = async (formData: {
    code: string;
    name: string;
    tel: string;
    fax: string;
    group: string;
    address: string;
    remark: string;
    isActive: boolean;
  }) => {
    console.log("📝 [UI Submit] Form Data:", formData);
    const { isActive, ...dto } = formData;
    if (formItem) {
      console.log(`✏️ [UI Action] Updating Company ID: ${formItem.id}`);
      await updateMutation.mutateAsync({ id: formItem.id, dto });
    } else {
      console.log("➕ [UI Action] Creating New Company");
      await createMutation.mutateAsync(dto);
    }
  };

  const handleDeleteConfirm = async (id: string | number) => {
    console.log(`❌ [UI Action] Confirm Delete Company ID: ${id}`);
    await deleteMutation.mutateAsync(id);
  };

  const statusLabel = useMemo(() => {
    if (statusFilter === "ACTIVE") return "ใช้งานปกติ";
    if (statusFilter === "INACTIVE") return "ระงับการใช้งาน";
    return "ทั้งหมด";
  }, [statusFilter]);

  const groupLabel = useMemo(() => {
    if (groupFilter === "ALL") return "ทั้งหมด";
    return groupFilter;
  }, [groupFilter]);

  return (
    <div className="flex flex-col h-[calc(100vh-6.5rem)] space-y-3 overflow-hidden">
      {/* Top Action Button */}
      <div className="flex items-center justify-end shrink-0 pr-2">
        <button
          type="button"
          onClick={handleOpenCreate}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
          <span>เพิ่มผู้ผลิต</span>
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-wrap items-center gap-4 bg-bg-component shadow-sm w-full rounded-sm p-4 shrink-0">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาชื่อ, รหัส หรือเบอร์โทร..."
            value={inputSearch}
            onChange={(e) => setInputSearch(e.target.value)}
            className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 transition-all"
          />
        </div>

        {/* Dropdown: หมวดหมู่ */}
        <div className="relative inline-flex items-center h-8 px-4 rounded-lg border border-slate-200 bg-white text-sm hover:border-slate-300 transition-colors cursor-pointer min-w-44 shrink-0 justify-between">
          <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2">
            <span className="text-slate-500 shrink-0">หมวดหมู่:</span>
            <span className="font-semibold text-emerald-600 truncate">
              {groupLabel}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
          <select
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
            value={groupFilter}
            onChange={(e) => {
              setGroupFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="ALL">ทั้งหมด</option>
            {availableGroups.map((grp) => (
              <option key={grp} value={grp}>
                {grp}
              </option>
            ))}
          </select>
        </div>

        {/* Dropdown: สถานะ */}
        <div className="relative inline-flex items-center h-8 px-4 rounded-lg border border-slate-200 bg-white text-sm hover:border-slate-300 transition-colors cursor-pointer w-48 shrink-0 justify-between">
          <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2">
            <span className="text-slate-500 shrink-0">สถานะ:</span>
            <span className="font-semibold text-emerald-600 truncate">
              {statusLabel}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
          <select
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as any);
              setCurrentPage(1);
            }}
          >
            <option value="ALL">ทั้งหมด</option>
            <option value="ACTIVE">ใช้งานปกติ</option>
            <option value="INACTIVE">ระงับการใช้งาน</option>
          </select>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-bg-component shadow-sm w-full rounded-sm overflow-hidden flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-auto min-h-0">
          <table className="w-full text-left">
            <thead className="font-bold text-sm border-b border-slate-200 bg-white sticky top-0 z-10 shadow-xs">
              <tr>
                <th className="py-3.5 px-6 font-bold text-slate-800 text-sm">
                  ID
                </th>
                <th className="py-3.5 px-6 font-bold text-slate-800 text-sm">
                  รหัส
                </th>
                <th className="py-3.5 px-6 font-bold text-slate-800 text-sm">
                  ผู้ผลิต / บริษัท
                </th>
                <th className="py-3.5 px-6 font-bold text-slate-800 text-sm">
                  เบอร์โทร
                </th>
                <th className="py-3.5 px-6 font-bold text-slate-800 text-sm">
                  หมวดหมู่
                </th>
                <th className="py-3.5 px-6 font-bold text-slate-800 text-sm">
                  สถานะ
                </th>
                <th className="py-3.5 px-6 font-bold text-slate-800 text-sm text-center">
                  จัดการ
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-12 text-center text-slate-400 text-base"
                  >
                    กำลังโหลดข้อมูลผู้ผลิต/บริษัท...
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-12 text-center text-slate-400 text-base"
                  >
                    ไม่พบข้อมูลผู้ผลิต/บริษัท
                  </td>
                </tr>
              ) : (
                paginatedData.map((item) => {
                  const isActive = !item.deletedAt && item.isActive !== false;
                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/60 transition-colors"
                    >
                      <td className="py-4 px-6 align-middle font-mono text-sm text-slate-500">
                        {String(item.id).padStart(3, "0")}
                      </td>
                      <td className="py-4 px-6 align-middle font-mono font-bold text-sm text-slate-800">
                        {item.code}
                      </td>
                      <td className="py-4 px-6 align-middle font-bold text-sm text-slate-900 max-w-xs truncate">
                        {item.name}
                      </td>
                      <td className="py-4 px-6 align-middle font-mono text-sm text-slate-600 whitespace-nowrap">
                        {item.tel || "-"}
                      </td>
                      <td className="py-4 px-6 align-middle text-sm text-slate-600">
                        {item.group || "-"}
                      </td>
                      <td className="py-4 px-6 align-middle">
                        <span className="inline-flex items-center gap-2 text-sm font-medium">
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${
                              isActive ? "bg-emerald-500" : "bg-slate-400"
                            }`}
                          />
                          <span
                            className={
                              isActive ? "text-slate-800 font-medium" : "text-slate-500"
                            }
                          >
                            {isActive ? "ใช้งานปกติ" : "ระงับการใช้งาน"}
                          </span>
                        </span>
                      </td>
                      <td className="py-4 px-6 align-middle">
                        <div className="flex items-center justify-center gap-4 text-slate-400">
                          <button
                            type="button"
                            title="ดูรายละเอียด"
                            onClick={() => handleOpenDetail(item)}
                            className="hover:text-sky-600 transition-colors cursor-pointer p-1"
                          >
                            <Eye className="h-5 w-5" />
                          </button>
                          <button
                            type="button"
                            title="แก้ไข"
                            onClick={() => handleOpenEdit(item)}
                            className="hover:text-amber-600 transition-colors cursor-pointer p-1"
                          >
                            <Pencil className="h-5 w-5" />
                          </button>
                          <button
                            type="button"
                            title="ลบ"
                            onClick={() => handleOpenDelete(item)}
                            className="hover:text-rose-600 transition-colors cursor-pointer p-1"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pinned Pagination Footer */}
        <div className="shrink-0 flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-2.5 border-t border-slate-100 text-sm text-slate-500 bg-white">
          <div>
            แสดง {totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1} ถึง{" "}
            {Math.min(currentPage * pageSize, totalItems)} จาก{" "}
            {totalItems.toLocaleString()} รายการ
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 1 || isLoading}
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            {visiblePages.map((page) => (
              <button
                key={page}
                type="button"
                disabled={isLoading}
                onClick={() => setCurrentPage(page)}
                className={`flex h-10 w-10 items-center justify-center rounded-xl border text-sm font-semibold transition-colors cursor-pointer ${
                  currentPage === page
                    ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {page}
              </button>
            ))}
            <button
              type="button"
              disabled={currentPage >= totalPages || isLoading}
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <CompanyDetailModal
        isOpen={isDetailOpen}
        item={detailItem}
        onClose={() => setIsDetailOpen(false)}
        onEdit={(item) => handleOpenEdit(item)}
      />

      <CompanyFormModal
        isOpen={isFormOpen}
        item={formItem}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleFormSubmit}
        isLoading={createMutation.isPending || updateMutation.isPending}
        availableGroups={availableGroups}
      />

      <CompanyDeleteModal
        isOpen={isDeleteOpen}
        item={deleteItem}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDeleteConfirm}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
