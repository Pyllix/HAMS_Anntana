import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  HardDriveDownload,
  Search,
  Loader2,
  Info,
  CheckCircle2,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useSparePartReturnModalStore } from "../../stores/useSparePartModalStore";
import type { SparePartReturnItem } from "../../types/TypeSparePart";
import {
  returnSparepart,
  getRepairByJobNo,
} from "../../services/sparepartService";

interface SparePartReturnItemExtended extends SparePartReturnItem {
  usedQtyInput?: number | "";
  isUsedEntered?: boolean;
}

export function SparePartReturnModal() {
  const queryClient = useQueryClient();

  const {
    isOpen,
    jobData: initialJobData,
    closeModal,
  } = useSparePartReturnModalStore();

  const [repairId, setRepairId] = useState<string>("");
  const [jobNoInput, setJobNoInput] = useState<string>("");
  const [equipmentName, setEquipmentName] = useState<string>("-");
  const [responsiblePerson, setResponsiblePerson] = useState<string>("-");

  const [isLoadingJob, setIsLoadingJob] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const [searchError, setSearchError] = useState<string>("");
  const [searchNotice, setSearchNotice] = useState<string>("");
  const [submitError, setSubmitError] = useState<string>("");

  const [returnItems, setReturnItems] = useState<SparePartReturnItemExtended[]>(
    [],
  );

  const resetForm = () => {
    setRepairId("");
    setJobNoInput("");
    setEquipmentName("-");
    setResponsiblePerson("-");
    setReturnItems([]);
    setSearchError("");
    setSearchNotice("");
    setSubmitError("");
  };

  const handleCloseModal = () => {
    resetForm();
    closeModal();
  };

  const formatUserName = (userObj: any): string => {
    if (!userObj) return "";
    if (typeof userObj === "string") return userObj.trim();

    const fn =
      userObj.firstname || userObj.firstName || userObj.first_name || "";
    const ln = userObj.lastname || userObj.lastName || userObj.last_name || "";
    const fullName = `${fn} ${ln}`.trim();

    return fullName || userObj.name || userObj.username || userObj.email || "";
  };

  const extractEvaluatorName = (data: any): string => {
    if (!data) return "-";

    if (Array.isArray(data.repairJobSteps) && data.repairJobSteps.length > 0) {
      const lastCompletedStep = [...data.repairJobSteps]
        .reverse()
        .find(
          (step: any) =>
            step.actionBy || step.user || step.actor || step.createdBy,
        );

      if (lastCompletedStep) {
        const stepUser = formatUserName(
          lastCompletedStep.actionBy ||
            lastCompletedStep.user ||
            lastCompletedStep.actor ||
            lastCompletedStep.createdBy,
        );
        if (stepUser) return stepUser;
      }
    }

    if (data.updater) {
      const updaterName = formatUserName(data.updater);
      if (updaterName) return updaterName;
    }

    const fallbackName = formatUserName(data.creator || data.reporter);
    if (fallbackName) return fallbackName;

    return "-";
  };

  const processSparePartItems = (
    rawList: any[],
  ): SparePartReturnItemExtended[] => {
    if (!Array.isArray(rawList)) return [];

    const tempMap = new Map<
      string,
      {
        validSparepartId: string | number;
        code: string;
        name: string;
        unit: string;
        totalBorrowed: number;
        hasBeenReturned: boolean;
      }
    >();

    rawList.forEach((txn: any) => {
      const sp = txn.sparepart || txn.sparePart || txn.item || {};
      const validSparepartId =
        txn.sparepartId ?? txn.sparepart_id ?? sp.id ?? "";
      const code = sp.code || txn.code || txn.sparepartCode || "-";
      const name = sp.name || txn.name || txn.sparepartName || "-";
      const unit = sp.unit || txn.unit || "ชิ้น";

      const qty = Number(
        txn.qty ?? txn.quantity ?? txn.borrowedQty ?? txn.amount ?? 0,
      );
      const txnType = String(
        txn.txnType || txn.type || txn.action || "",
      ).toUpperCase();
      const isReturnTxn =
        txnType.includes("IN") ||
        txnType.includes("RETURN") ||
        txn.isReturn === true;

      const groupKey = validSparepartId
        ? `id-${validSparepartId}`
        : `code-${code}`;

      if (!tempMap.has(groupKey)) {
        tempMap.set(groupKey, {
          validSparepartId,
          code,
          name,
          unit,
          totalBorrowed: 0,
          hasBeenReturned: false,
        });
      }

      const item = tempMap.get(groupKey)!;

      if (isReturnTxn) {
        item.hasBeenReturned = true;
      } else {
        item.totalBorrowed += qty;
      }
    });

    const result: SparePartReturnItemExtended[] = [];

    tempMap.forEach((item) => {
      if (item.totalBorrowed > 0 && !item.hasBeenReturned) {
        result.push({
          sparepartId: Number(item.validSparepartId) || 0,
          code: item.code,
          name: item.name,
          borrowedQty: item.totalBorrowed,
          usedQty: 0,
          usedQtyInput: "",
          isUsedEntered: false,
          returnQty: 0,
          unit: item.unit,
        });
      }
    });

    return result;
  };

  const fetchJobDetails = useCallback(async (jobNoToSearch: string) => {
    if (!jobNoToSearch.trim()) return;

    setIsLoadingJob(true);
    setSearchError("");
    setSearchNotice("");

    try {
      const response = await getRepairByJobNo(jobNoToSearch.trim());
      const data = response?.data || response;

      if (data && (data.id || data.jobNo)) {
        setRepairId(String(data.id || ""));
        setEquipmentName(
          data.asset?.name || data.equipmentName || data.equipment?.name || "-",
        );
        setResponsiblePerson(extractEvaluatorName(data));

        const rawSpareParts =
          data.sparepartTxns ||
          data.repairSpareParts ||
          data.spareParts ||
          data.items ||
          [];
        const processedItems = processSparePartItems(rawSpareParts);

        if (data.isCompleted || processedItems.length === 0) {
          setSearchNotice(
            "ใบแจ้งซ่อมรหัสนี้ ได้ทำการบันทึกรับคืนอะไหล่เสร็จสิ้นแล้ว",
          );
          setReturnItems([]);
          return;
        }

        setReturnItems(processedItems);
      } else {
        setSearchError("ไม่พบข้อมูลใบแจ้งซ่อมรหัสนี้");
        setRepairId("");
        setEquipmentName("-");
        setResponsiblePerson("-");
        setReturnItems([]);
      }
    } catch (error) {
      console.error("Error fetching job data:", error);
      setSearchError("เกิดข้อผิดพลาดในการดึงข้อมูลใบแจ้งซ่อม");
      setRepairId("");
      setEquipmentName("-");
      setResponsiblePerson("-");
      setReturnItems([]);
    } finally {
      setIsLoadingJob(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (initialJobData?.jobNo) {
        setJobNoInput(initialJobData.jobNo);
        fetchJobDetails(initialJobData.jobNo);
      } else {
        resetForm();
      }
    } else {
      resetForm();
    }
  }, [isOpen, initialJobData, fetchJobDetails]);

  const handleUsedQtyChange = (index: number, rawVal: string) => {
    setReturnItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;

        if (rawVal === "") {
          return {
            ...item,
            usedQtyInput: "",
            usedQty: 0,
            isUsedEntered: false,
            returnQty: 0,
          };
        }

        const numericVal = Number(rawVal);
        if (isNaN(numericVal)) return item;

        const validUsed = Math.min(item.borrowedQty, Math.max(0, numericVal));
        const autoReturnQty = item.borrowedQty - validUsed;

        return {
          ...item,
          usedQtyInput: validUsed,
          usedQty: validUsed,
          isUsedEntered: true,
          returnQty: autoReturnQty,
        };
      }),
    );
  };

  const isAllItemsEntered =
    returnItems.length > 0 && returnItems.every((item) => item.isUsedEntered);
  const isFormValid = isAllItemsEntered && Boolean(repairId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");

    if (!isFormValid) return;

    setIsSubmitting(true);

    try {
      await Promise.all(
        returnItems.map((item) =>
          returnSparepart(repairId, {
            sparepartId: Number(item.sparepartId),
            qty: Number(item.returnQty),
          }),
        ),
      );

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["spareParts"] }),
        queryClient.invalidateQueries({ queryKey: ["repairs"] }),
      ]);

      handleCloseModal();
    } catch (error) {
      console.error("Error submitting return:", error);
      setSubmitError("เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-3xl rounded-3xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100/80 flex items-center justify-center text-[#00A96E]">
              <HardDriveDownload className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-lg leading-snug">
                บันทึกรับคืนอะไหล่
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                บันทึกนำส่งอะไหล่ไม่ได้ใช้งานหรือใช้ไม่หมดจากงานซ่อมกลับเข้าสต็อก
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCloseModal}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-[#00A96E] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          className="p-7 space-y-6 max-h-[78vh] overflow-y-auto"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-50/80 border border-slate-100 text-xs">
            <div>
              <label className="block text-slate-500 font-medium mb-1">
                อ้างอิงใบแจ้งซ่อม (Job No.){" "}
                <span className="text-red-500">*</span>
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  placeholder="เช่น REP-202609-0021"
                  value={jobNoInput}
                  onChange={(e) => {
                    setJobNoInput(e.target.value);
                    if (searchError) setSearchError("");
                    if (searchNotice) setSearchNotice("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      fetchJobDetails(jobNoInput);
                    }
                  }}
                  className={`w-full h-8 pl-3 pr-8 rounded-lg bg-white border font-bold text-slate-800 focus:outline-none transition-colors ${
                    searchError
                      ? "border-red-500 focus:border-red-500 ring-1 ring-red-500/20"
                      : "border-slate-200 focus:border-slate-500"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => fetchJobDetails(jobNoInput)}
                  disabled={isLoadingJob}
                  className="absolute right-1.5 p-1 rounded-md text-slate-400 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  {isLoadingJob ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Search className="w-3.5 h-3.5 text-slate-500" />
                  )}
                </button>
              </div>
              {searchError && (
                <p className="text-[11px] text-red-500 mt-1 font-medium flex items-center gap-1">
                  {searchError}
                </p>
              )}
            </div>

            <div>
              <label className="block text-slate-500 font-medium mb-1">
                ครุภัณฑ์ที่เกี่ยวข้อง
              </label>
              <input
                type="text"
                disabled
                value={equipmentName}
                className="w-full h-8 px-3 rounded-lg bg-slate-100 border border-slate-200 font-bold text-slate-700 truncate cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-slate-500 font-medium mb-1">
                ผู้ส่งคืน (ผู้ประเมิน)
              </label>
              <input
                type="text"
                disabled
                value={responsiblePerson}
                className="w-full h-8 px-3 rounded-lg bg-slate-100 border border-slate-200 font-bold text-slate-700 cursor-not-allowed"
              />
            </div>
          </div>

          {/* Banner แจ้งเตือน */}
          {searchNotice && (
            <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 text-blue-700 text-xs flex items-center gap-2.5">
              <Info className="w-4 h-4 text-blue-500 shrink-0" />
              <p className="font-medium">{searchNotice}</p>
            </div>
          )}

          {/* Table */}
          <div className="space-y-3">
            <h3 className="font-bold text-slate-800 text-xs">
              รายการอะไหล่ที่เบิกใน Job นี้
            </h3>
            <div className="overflow-hidden border border-slate-100 rounded-2xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold">
                  <tr>
                    <th className="py-3 px-4 whitespace-nowrap">
                      รหัสอะไหล่ / รายการ
                    </th>
                    <th className="py-3 px-2 text-center whitespace-nowrap">
                      เบิกมา
                    </th>
                    <th className="py-3 px-2 text-center w-36 whitespace-nowrap">
                      ใช้จริง <span className="text-red-500">*</span>
                    </th>
                    <th className="py-3 px-4 text-center w-36 whitespace-nowrap">
                      จำนวนคืน
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {returnItems.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-8 text-center text-slate-400"
                      >
                        {isLoadingJob ? (
                          <div className="flex items-center justify-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>กำลังดึงข้อมูลรายการอะไหล่...</span>
                          </div>
                        ) : searchNotice ? (
                          <div className="flex flex-col items-center justify-center gap-1 text-slate-500">
                            <CheckCircle2 className="w-6 h-6 text-emerald-500 mb-1" />
                            <span className="font-semibold text-slate-700">
                              ไม่มีรายการค้างคืน
                            </span>
                            <span className="text-[11px] text-slate-400">
                              รายการรับคืนทั้งหมดใน Job นี้ได้รับการบันทึกแล้ว
                            </span>
                          </div>
                        ) : (
                          "โปรดระบุ Job No. เพื่อค้นหารายการอะไหล่"
                        )}
                      </td>
                    </tr>
                  ) : (
                    returnItems.map((item, idx) => {
                      const unitText = item.unit || "ชิ้น";

                      return (
                        <tr
                          key={
                            item.sparepartId
                              ? `sp-${item.sparepartId}-${idx}`
                              : `code-${item.code}-${idx}`
                          }
                          className="hover:bg-slate-50/50"
                        >
                          <td className="py-3 px-4">
                            <p className="font-bold text-slate-900 font-mono">
                              {item.code}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              {item.name}
                            </p>
                          </td>
                          <td className="py-3 px-2 text-center font-semibold whitespace-nowrap">
                            {item.borrowedQty}{" "}
                            <span className="text-[11px] font-normal text-slate-400">
                              {unitText}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-center">
                            <div className="inline-flex items-center gap-1.5 justify-center">
                              <input
                                type="number"
                                placeholder="0"
                                value={item.usedQtyInput ?? ""}
                                min={0}
                                max={item.borrowedQty}
                                onChange={(e) =>
                                  handleUsedQtyChange(idx, e.target.value)
                                }
                                className={`w-16 h-8 text-center font-bold rounded-lg border transition-colors ${
                                  !item.isUsedEntered
                                    ? "border-red-400 bg-red-50/30 text-red-600 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                                    : "border-slate-200 text-emerald-600 bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                                }`}
                              />
                              <span className="text-[11px] text-slate-500 font-medium whitespace-nowrap">
                                {unitText}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="inline-flex items-center gap-1.5 justify-center">
                              <input
                                type="text"
                                readOnly
                                disabled
                                value={
                                  item.isUsedEntered ? item.returnQty : "-"
                                }
                                className={`w-16 h-8 text-center font-bold rounded-lg cursor-not-allowed select-none transition-colors ${
                                  item.isUsedEntered && item.returnQty > 0
                                    ? "text-[#00A96E] border border-emerald-300 bg-emerald-50/30"
                                    : "text-slate-400 border border-slate-200 bg-slate-100 opacity-70"
                                }`}
                              />
                              <span className="text-[11px] text-slate-500 font-medium whitespace-nowrap">
                                {unitText}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {submitError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-medium">
              {submitError}
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={handleCloseModal}
              className="px-5 h-9 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !isFormValid}
              className={`px-5 h-9 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1.5 ${
                isFormValid
                  ? "bg-emerald-600 text-white hover:bg-emerald-700 opacity-100"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed opacity-70"
              }`}
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              บันทึกการรับคืน
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}