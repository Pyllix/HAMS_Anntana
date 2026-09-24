import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp,
  Building2,
  Calendar,
  RefreshCw,
  ShieldCheck,
  ArrowUpRight,
  PieChart,
  Table as TableIcon,
  Wrench,
  ShoppingCart,
  Layers,
  Sparkles,
  Info,
  CheckCircle2,
  Award,
  Clock,
  AlertTriangle,
  Coins,
  PackageCheck,
  AlertCircle,
} from "lucide-react";
import {
  getExpenseForecast,
  calculateExpenseBreakdown,
  calculateMonthlySectionRanking,
  formatThaiMonth,
  ExpenseBreakdown,
} from "../services/forecastService";
import ForecastLineChart, { DataPoint } from "../components/forecast/ForecastLineChart";

export default function ExpenseForecast() {
  const [selectedSection, setSelectedSection] = useState<string>("all");
  const predictionMonths = 12;
  const [selectedPoint, setSelectedPoint] = useState<DataPoint | null>(null);
  const [sideTab, setSideTab] = useState<"breakdown" | "ranking" | "lifespan" | "table">("breakdown");
  const [mainGraphMode, setMainGraphMode] = useState<"forecast" | "lifespan">("forecast");
  const [lifespanViewMode, setLifespanViewMode] = useState<"types" | "assets" | "phased">("types");

  const [sections] = useState<Array<{ id: string; name: string; code: string }>>([]);

  const {
    data: forecastData, 
    isLoading, 
    isFetching, 
    refetch 
  } = useQuery({
    queryKey: ["expenseForecast", selectedSection, predictionMonths],
    queryFn: () => getExpenseForecast(selectedSection, predictionMonths),
    staleTime: 1000 * 60 * 15,
  });

  // ตั้งค่าจุดเริ่มต้นที่เลือกเมื่อข้อมูลโหลดมาถึง
  useEffect(() => {
    if (!forecastData) return;
    
    // หากมีข้อมูลพยากรณ์ ให้เริ่มต้นเลือกจุดแรกของอนาคต (หรือจุดสุดท้ายของอดีต)
    if (forecastData.ensemble && forecastData.ensemble.length > 0) {
      const firstFuture = forecastData.ensemble[0];
      setSelectedPoint({
        date: firstFuture.date,
        cost: firstFuture.forecast,
        isFuture: true,
        forecast: firstFuture.forecast,
        lower: firstFuture.lower_bound,
        upper: firstFuture.upper_bound,
        repairs_cost: firstFuture.repairs_cost,
        acquisitions_cost: firstFuture.acquisitions_cost,
        section_rankings: firstFuture.section_rankings,
        notes: firstFuture.notes,
      });
    } else if (forecastData.history && forecastData.history.length > 0) {
      const lastHist = forecastData.history[forecastData.history.length - 1];
      setSelectedPoint({
        date: lastHist.date,
        cost: lastHist.cost,
        isFuture: false,
        repairs_cost: lastHist.repairs_cost,
        acquisitions_cost: lastHist.acquisitions_cost,
        section_rankings: lastHist.section_rankings,
      });
    }
  }, [forecastData]);

  // คำนวณแจกแจงประเภทรายจ่ายของเดือนที่ถูกเลือก (ใช้ข้อมูลจริงจาก DB หากมี)
  const currentBreakdown: ExpenseBreakdown | null = useMemo(() => {
    if (!selectedPoint) return null;
    return calculateExpenseBreakdown(
      selectedPoint.cost,
      selectedPoint.date,
      selectedPoint.repairs_cost,
      selectedPoint.acquisitions_cost,
    );
  }, [selectedPoint]);

  // ค้นหาแผนกที่มีค่าใช้จ่ายสะสมสูงสุด
  const topSection = useMemo(() => {
    if (forecastData?.top_sections && forecastData.top_sections.length > 0) {
      return forecastData.top_sections[0];
    }
    return null;
  }, [forecastData]);

  // คำนวณอันดับแผนกที่ใช้จ่ายเยอะที่สุดของเดือนที่เลือก (ใช้ข้อมูลจริงจาก DB หากมี)
  const monthlySectionRanking = useMemo(() => {
    if (!selectedPoint) return [];
    if (selectedPoint.section_rankings && selectedPoint.section_rankings.length > 0) {
      return selectedPoint.section_rankings;
    }
    const availableSections = forecastData?.top_sections || forecastData?.sections;
    return calculateMonthlySectionRanking(selectedPoint.cost, selectedPoint.date, availableSections);
  }, [selectedPoint, forecastData]);

  const kpis = useMemo(() => {
    if (!forecastData?.ensemble || forecastData.ensemble.length === 0) {
      return { total: 0, avg: 0, maxMonth: "-", maxVal: 0, minMonth: "-", minVal: 0 };
    }
    const total = forecastData.ensemble.reduce((acc, curr) => acc + curr.forecast, 0);
    const avg = total / forecastData.ensemble.length;
    let max = forecastData.ensemble[0];
    let min = forecastData.ensemble[0];
    forecastData.ensemble.forEach((item) => {
      if (item.forecast > max.forecast) max = item;
      if (item.forecast < min.forecast) min = item;
    });

    return {
      total,
      avg,
      maxMonth: max.date,
      maxVal: max.forecast,
      minMonth: min.date,
      minVal: min.forecast,
    };
  }, [forecastData]);

  return (
    <div className="p-2 sm:p-2.5 max-w-[1600px] mx-auto flex flex-col gap-2">
      {/* Top Controls (Department & Horizon Dropdowns on Top Right) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-2 w-full">
        {/* Section Selector */}
        <div className="flex items-center gap-2 bg-white border border-slate-200 shadow-xs rounded-xl px-2.5 py-1.5 w-full sm:w-auto min-w-0">
          <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            className="bg-transparent text-xs font-medium text-slate-700 outline-none cursor-pointer w-full sm:w-auto truncate"
          >
            <option value="all">ทุกแผนก (ภาพรวมทั้งโรงพยาบาล)</option>
            {(forecastData?.sections || sections)?.map((sec) => (
              <option key={sec.id} value={sec.id}>
                {sec.name} ({sec.code})
              </option>
            ))}
          </select>
        </div>

        {/* Fixed 12 Months Badge & Refresh Group */}
        <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 shadow-xs rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-700">
            <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>ทำนาย 12 เดือน (1 ปี)</span>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-1.5 sm:p-2 bg-white text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 border border-slate-200 shadow-xs rounded-xl transition-all shrink-0 cursor-pointer"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin text-emerald-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards (Compact Single-Screen Fit) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {/* Card 1: Total Forecast */}
        <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center text-slate-500 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-4 rounded-full bg-slate-400 shrink-0 inline-block"></span>
              <span className="font-semibold text-slate-700">งบประมาณคาดการณ์รวม</span>
            </div>
            <div className="p-1.5 bg-slate-100 text-slate-600 rounded-lg">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-1.5">
            <h3 className="text-xl sm:text-2xl font-black tracking-tight text-slate-800">
              {isLoading ? "..." : `฿${kpis.total.toLocaleString("th-TH", { maximumFractionDigits: 0 })}`}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">ยอดรวม {predictionMonths} เดือนล่วงหน้า</p>
          </div>
        </div>

        {/* Card 2: Average Monthly */}
        <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center text-slate-500 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-4 rounded-full bg-emerald-600 shrink-0 inline-block"></span>
              <span className="font-semibold text-slate-700">ค่าใช้จ่ายเฉลี่ยต่อเดือน</span>
            </div>
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-1.5">
            <h3 className="text-xl sm:text-2xl font-black tracking-tight text-emerald-600">
              {isLoading ? "..." : `฿${kpis.avg.toLocaleString("th-TH", { maximumFractionDigits: 0 })}`}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">เฉลี่ยต่อเดือนโดยประมาณ</p>
          </div>
        </div>

        {/* Card 3: Peak Month */}
        <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center text-slate-500 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-4 rounded-full bg-amber-500 shrink-0 inline-block"></span>
              <span className="font-semibold text-slate-700">เดือนที่คาดว่างบสูงสุด (Peak)</span>
            </div>
            <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-1.5">
            <h3 className="text-xl sm:text-2xl font-black tracking-tight text-amber-600">
              {isLoading ? "..." : kpis.maxMonth}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              จุดพีค: ฿{kpis.maxVal.toLocaleString("th-TH", { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>

        {/* Card 4: Asset Lifespan Exceeded */}
        <div
          onClick={() => {
            setMainGraphMode("lifespan");
          }}
          className={`p-2.5 sm:p-3 rounded-xl border shadow-sm cursor-pointer transition-all group flex flex-col justify-between ${
            mainGraphMode === "lifespan"
              ? "bg-rose-50/70 border-rose-400 ring-1 ring-rose-300"
              : "bg-white border-rose-100 hover:border-rose-300"
          }`}
          title="คลิกเพื่อสลับพื้นที่กราฟเป็นการวางแผนงบประมาณตามอายุขัยครุภัณฑ์"
        >
          <div className="flex justify-between items-center text-slate-500 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-4 rounded-full bg-rose-600 shrink-0 inline-block"></span>
              <span className="font-semibold text-rose-800 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                ครุภัณฑ์ครบอายุขัย
              </span>
            </div>
            <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg group-hover:bg-rose-100 transition-colors">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-1.5">
            <h3 className="text-xl sm:text-2xl font-black tracking-tight text-rose-600">
              {isLoading ? "..." : `${forecastData?.asset_lifespan?.exceeded_count || 0} เครื่อง (${forecastData?.asset_lifespan?.exceeded_percentage || 0}%)`}
            </h3>
            <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center justify-between gap-1">
              <span className="truncate">งบทดแทน ฿{(forecastData?.asset_lifespan?.total_replacement_budget || 0).toLocaleString("th-TH")}</span>
              <span className="font-semibold text-rose-700 bg-rose-100 px-1.5 py-0.2 rounded text-[9px] shrink-0">
                คลิกดูแผน &rarr;
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Chart & Expense Breakdown Side Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
        {/* Visual Line Chart Card (Supports Mode Toggle) */}
        <div className="lg:col-span-2 bg-white p-3 sm:p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            {/* Header: Dynamic Title and Mode Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-2">
                  {mainGraphMode === "forecast" ? (
                    <>
                      <TrendingUp className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>กราฟเส้นแนวโน้มค่าใช้จ่ายจริง vs งบประมาณคาดการณ์</span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>การวางแผนงบประมาณตามอายุขัยครุภัณฑ์ (Capital Planning)</span>
                    </>
                  )}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {mainGraphMode === "forecast"
                    ? "คลิกที่จุดใดก็ได้บนเส้นกราฟเพื่อดูสัดส่วนประเภทรายจ่ายประจำเดือนนั้น"
                    : `วิเคราะห์ครุภัณฑ์ครบอายุขัย ${forecastData?.asset_lifespan?.exceeded_count || 0} เครื่อง งบประมาณทดแทนรวม ฿${(forecastData?.asset_lifespan?.total_replacement_budget || 0).toLocaleString()} บาท`}
                </p>
              </div>

              {/* Mode Toggle Switcher */}
              <div className="flex items-center bg-slate-100/90 p-0.5 rounded-xl text-xs font-semibold shrink-0 self-start sm:self-auto">
                <button
                  onClick={() => setMainGraphMode("forecast")}
                  className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer text-xs ${
                    mainGraphMode === "forecast"
                      ? "bg-white text-slate-900 font-bold shadow-xs"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                  <span>งบประมาณคาดการณ์</span>
                </button>
                <button
                  onClick={() => setMainGraphMode("lifespan")}
                  className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer text-xs ${
                    mainGraphMode === "lifespan"
                      ? "bg-white text-rose-800 font-bold shadow-xs"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 text-rose-500" />
                  <span>วางแผนตามอายุขัย</span>
                </button>
              </div>
            </div>

            {/* Mode 1: Forecast Line Chart */}
            {mainGraphMode === "forecast" ? (
              <ForecastLineChart
                history={forecastData?.history || []}
                ensemble={forecastData?.ensemble || []}
                isLoading={isLoading}
                selectedDate={selectedPoint?.date}
                onSelectPoint={(point) => {
                  setSelectedPoint(point);
                  if (sideTab === "table") {
                    setSideTab("breakdown");
                  }
                }}
              />
            ) : (
              /* Mode 2: Asset Lifespan Budget Planning View */
              <div className="space-y-2">
                {/* Sub-view switcher */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-1.5 bg-slate-50 rounded-xl border border-slate-200/70 text-xs">
                  <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200/80">
                    <button
                      onClick={() => setLifespanViewMode("types")}
                      className={`px-2.5 py-1 rounded-md transition-all cursor-pointer font-medium ${
                        lifespanViewMode === "types"
                          ? "bg-slate-900 text-white font-bold"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      สรุปตามประเภท ({forecastData?.asset_lifespan?.types_summary?.length || 0})
                    </button>
                    <button
                      onClick={() => setLifespanViewMode("assets")}
                      className={`px-2.5 py-1 rounded-md transition-all cursor-pointer font-medium ${
                        lifespanViewMode === "assets"
                          ? "bg-slate-900 text-white font-bold"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      เครื่องเด่นถึงอายุขัย ({forecastData?.asset_lifespan?.critical_assets?.length || 0})
                    </button>
                    <button
                      onClick={() => setLifespanViewMode("phased")}
                      className={`px-2.5 py-1 rounded-md transition-all cursor-pointer font-medium ${
                        lifespanViewMode === "phased"
                          ? "bg-slate-900 text-white font-bold"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      แผนทยอยจัดสรร 3 ปี
                    </button>
                  </div>

                  <div className="text-[11px] text-slate-500 font-semibold px-2">
                    งบทดแทนรวม: <span className="text-rose-700 font-black">฿{(forecastData?.asset_lifespan?.total_replacement_budget || 0).toLocaleString()}</span>
                  </div>
                </div>

                {/* Sub-view content */}
                {lifespanViewMode === "types" && (
                  <div className="overflow-x-auto overflow-y-auto max-h-[290px] border border-slate-200/80 rounded-xl">
                    <table className="w-full text-left text-xs min-w-[580px]">
                      <thead className="bg-slate-50 text-slate-500 sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3 font-semibold">ประเภทครุภัณฑ์</th>
                          <th className="py-2.5 px-3 font-semibold text-center">เกณฑ์อายุ</th>
                          <th className="py-2.5 px-3 font-semibold text-center">กำลังใช้งาน</th>
                          <th className="py-2.5 px-3 font-semibold text-center">เกินอายุขัย</th>
                          <th className="py-2.5 px-3 font-semibold">สัดส่วนเกินอายุ</th>
                          <th className="py-2.5 px-3 font-semibold text-right">งบทดแทนที่ควรเตรียม</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {forecastData?.asset_lifespan?.types_summary?.map((t) => {
                          const pct = t.active_count > 0 ? Math.round((t.exceeded_count / t.active_count) * 100) : 0;
                          return (
                            <tr key={t.type_id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-2 px-3 font-bold text-slate-800">{t.type_name}</td>
                              <td className="py-2 px-3 text-center text-slate-500">{t.useful_life} ปี</td>
                              <td className="py-2 px-3 text-center text-slate-600 font-medium">{t.active_count} เครื่อง</td>
                              <td className="py-2 px-3 text-center font-bold text-rose-600">{t.exceeded_count} เครื่อง</td>
                              <td className="py-2 px-3 min-w-32">
                                <div className="flex items-center gap-2">
                                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full transition-all duration-300 ${
                                        pct > 70 ? "bg-rose-500" : pct > 40 ? "bg-amber-500" : "bg-emerald-500"
                                      }`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <span className="text-[10px] font-bold text-slate-600 w-8 text-right">{pct}%</span>
                                </div>
                              </td>
                              <td className="py-2 px-3 text-right font-bold text-rose-700">
                                ฿{t.replacement_value.toLocaleString("th-TH")}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {lifespanViewMode === "assets" && (
                  <div className="overflow-x-auto overflow-y-auto max-h-[290px] border border-slate-200/80 rounded-xl">
                    <table className="w-full text-left text-xs min-w-[650px]">
                      <thead className="bg-slate-50 text-slate-500 sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3 font-semibold">ชื่อครุภัณฑ์ / รุ่น</th>
                          <th className="py-2.5 px-3 font-semibold">ประเภท</th>
                          <th className="py-2.5 px-3 font-semibold">แผนก</th>
                          <th className="py-2.5 px-3 font-semibold text-center">วันที่รับ</th>
                          <th className="py-2.5 px-3 font-semibold text-center">ครบอายุขัย</th>
                          <th className="py-2.5 px-3 font-semibold text-center">อายุจริง</th>
                          <th className="py-2.5 px-3 font-semibold text-right">ราคาจัดซื้อ</th>
                          <th className="py-2.5 px-3 font-semibold text-center">สถานะ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {forecastData?.asset_lifespan?.critical_assets?.map((asset) => (
                          <tr key={asset.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2 px-3">
                              <div className="font-bold text-slate-800 truncate max-w-[160px]">{asset.name}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{asset.model || "-"}</div>
                            </td>
                            <td className="py-2 px-3 text-slate-600 truncate max-w-[110px]">{asset.asset_type}</td>
                            <td className="py-2 px-3 text-slate-700 font-medium truncate max-w-[100px]">{asset.section_name}</td>
                            <td className="py-2 px-3 text-center text-slate-500 text-[11px]">{asset.receive_date}</td>
                            <td className="py-2 px-3 text-center font-semibold text-rose-700 text-[11px]">{asset.expiry_date}</td>
                            <td className="py-2 px-3 text-center font-bold text-slate-700">{asset.age_years} ปี</td>
                            <td className="py-2 px-3 text-right font-black text-slate-800">฿{asset.price.toLocaleString()}</td>
                            <td className="py-2 px-3 text-center">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                  asset.status === "EXCEEDED"
                                    ? "bg-rose-50 text-rose-700 border-rose-200"
                                    : "bg-amber-50 text-amber-700 border-amber-200"
                                }`}
                              >
                                {asset.status === "EXCEEDED" ? "เลยอายุขัย" : "ใกล้ครบ"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {lifespanViewMode === "phased" && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                    {/* Phase 1 */}
                    <div className="p-3 bg-gradient-to-br from-rose-50/70 to-white rounded-xl border border-rose-200/80 shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">เฟส 1: เร่งด่วน (40%)</span>
                          <span className="text-[10px] text-slate-400">ปีงบประมาณที่ 1</span>
                        </div>
                        <h4 className="text-base font-black text-rose-800">
                          ฿{Math.round((forecastData?.asset_lifespan?.total_replacement_budget || 0) * 0.40).toLocaleString()}
                        </h4>
                        <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                          เน้นเครื่องมือแพทย์วิกฤต ICU/ห้องผ่าตัด ที่อายุเกินเกณฑ์ &gt; 5 ปี เพื่อลดความเสี่ยงเสียกลางคันและค่าซ่อมฉุกเฉิน
                        </p>
                      </div>
                    </div>

                    {/* Phase 2 */}
                    <div className="p-3 bg-gradient-to-br from-amber-50/70 to-white rounded-xl border border-amber-200/80 shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">เฟส 2: ยกระดับ (35%)</span>
                          <span className="text-[10px] text-slate-400">ปีงบประมาณที่ 2</span>
                        </div>
                        <h4 className="text-base font-black text-amber-800">
                          ฿{Math.round((forecastData?.asset_lifespan?.total_replacement_budget || 0) * 0.35).toLocaleString()}
                        </h4>
                        <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                          ทยอยจัดซื้อเครื่องตรวจวิเคราะห์ทางห้องปฏิบัติการ และเครื่องสนับสนุนการพยาบาลทั่วไปตามรอบ
                        </p>
                      </div>
                    </div>

                    {/* Phase 3 */}
                    <div className="p-3 bg-gradient-to-br from-emerald-50/70 to-white rounded-xl border border-emerald-200/80 shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">เฟส 3: สำรอง (25%)</span>
                          <span className="text-[10px] text-slate-400">ปีงบประมาณที่ 3</span>
                        </div>
                        <h4 className="text-base font-black text-emerald-800">
                          ฿{Math.round((forecastData?.asset_lifespan?.total_replacement_budget || 0) * 0.25).toLocaleString()}
                        </h4>
                        <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                          อุปกรณ์สำนักงานและระบบสนับสนุนอาคารที่มีอะไหล่ทดแทนได้ ช่วยกระจายภาระงบประมาณอย่างสมดุล
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Bar */}
          <div className="text-[11px] text-slate-400 border-t border-slate-100 pt-2 mt-2 flex flex-wrap justify-between items-center gap-2">
            {mainGraphMode === "forecast" ? (
              <>
                <span>เส้นทึบสีเข้ม = ประวัติจริงในอดีต</span>
                <span className="text-emerald-600 font-medium">เส้นประสีมรกต = งบประมาณคาดการณ์ล่วงหน้า 12 เดือน</span>
              </>
            ) : (
              <>
                <span className="flex items-center gap-1 text-slate-500">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  การวางแผนจัดสรร 3 เฟสช่วยบริหารสภาพคล่องและลดต้นทุนค่าซ่อมบำรุงสะสม (+{Math.round(((forecastData?.asset_lifespan?.maintenance_risk_factor || 1) - 1) * 100)}%)
                </span>
                <button
                  onClick={() => setMainGraphMode("forecast")}
                  className="text-emerald-700 font-bold hover:underline cursor-pointer"
                >
                  &larr; กลับไปดูกราฟพยากรณ์งบประมาณ
                </button>
              </>
            )}
          </div>
        </div>

        {/* Side Panel: Monthly Expense Breakdown, Ranking & Forecast Table */}
        <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            {/* Tab Switch Header */}
            <div className="border-b border-slate-100 pb-2 mb-2.5">
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-1.5 bg-slate-100/80 p-1.5 rounded-xl text-xs font-medium w-full">
                <button
                  onClick={() => setSideTab("breakdown")}
                  className={`px-3 py-2 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    sideTab === "breakdown"
                      ? "bg-white text-slate-800 font-bold shadow-xs"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <PieChart className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="whitespace-nowrap">ประเภทรายจ่าย</span>
                </button>

                <button
                  onClick={() => setSideTab("ranking")}
                  className={`px-3 py-2 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    sideTab === "ranking"
                      ? "bg-white text-slate-800 font-bold shadow-xs"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <Award className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="whitespace-nowrap">อันดับแผนก</span>
                </button>

                <button
                  onClick={() => setSideTab("lifespan")}
                  className={`px-3 py-2 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    sideTab === "lifespan"
                      ? "bg-white text-slate-800 font-bold shadow-xs"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <Clock className="w-4 h-4 text-rose-500 shrink-0" />
                  <span className="whitespace-nowrap">อายุขัยครุภัณฑ์</span>
                </button>

                <button
                  onClick={() => setSideTab("table")}
                  className={`px-3 py-2 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    sideTab === "table"
                      ? "bg-white text-slate-800 font-bold shadow-xs"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <TableIcon className="w-4 h-4 text-slate-500 shrink-0" />
                  <span className="whitespace-nowrap">ตาราง 12 เดือน</span>
                </button>
              </div>
            </div>

            {/* TAB 1: EXPENSE BREAKDOWN */}
            {sideTab === "breakdown" && (
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {isLoading ? (
                  <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                    <div className="w-7 h-7 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                    <p className="text-xs">กำลังโหลดรายละเอียดรายจ่าย...</p>
                  </div>
                ) : selectedPoint && currentBreakdown ? (
                  <>
                    {/* Selected Month Banner */}
                    <div className="bg-gradient-to-br from-slate-50 to-emerald-50/40 p-4 rounded-xl border border-slate-200/70">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-semibold text-slate-500">
                            {formatThaiMonth(selectedPoint.date)}
                          </span>
                          <h4 className="text-xl font-black text-slate-800 mt-0.5">
                            ฿{selectedPoint.cost.toLocaleString("th-TH", { maximumFractionDigits: 0 })}
                          </h4>
                        </div>

                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                            selectedPoint.isFuture
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 font-bold"
                              : "bg-slate-100 text-slate-700 border-slate-200"
                          }`}
                        >
                          {selectedPoint.isFuture ? "ประมาณการ AI" : "ข้อมูลจริง"}
                        </span>
                      </div>

                      {selectedPoint.isFuture && selectedPoint.lower && selectedPoint.upper && (
                        <div className="mt-2 pt-2 border-t border-slate-200/60 text-[11px] text-slate-500 flex justify-between">
                          <span>กรอบความเสี่ยง:</span>
                          <span className="font-semibold text-slate-700">
                            ฿{selectedPoint.lower.toLocaleString("th-TH", { maximumFractionDigits: 0 })} - ฿{selectedPoint.upper.toLocaleString("th-TH", { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      )}

                      {/* Segmented Combined Progress Bar */}
                      <div className="mt-3">
                        <div className="h-2 w-full bg-slate-200/80 rounded-full overflow-hidden flex">
                          {currentBreakdown.categories.map((cat) => (
                            <div
                              key={cat.id}
                              style={{ width: `${cat.percentage}%` }}
                              className={`${cat.bgColor} transition-all duration-300`}
                              title={`${cat.name}: ${cat.percentage}%`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Breakdown Category Cards (2 Real Categories) */}
                    <div className="space-y-3">
                      {currentBreakdown.categories.map((cat) => {
                        const isAcquisition = cat.id === "acquisitions";
                        return (
                          <div
                            key={cat.id}
                            className="p-3.5 bg-white hover:bg-slate-50/80 rounded-xl border border-slate-200/80 transition-all shadow-xs"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2.5">
                                <div className={`p-2 rounded-xl ${cat.lightBgColor}`}>
                                  {isAcquisition ? (
                                    <ShoppingCart className="w-4 h-4 text-emerald-600" />
                                  ) : (
                                    <Wrench className="w-4 h-4 text-amber-600" />
                                  )}
                                </div>
                                <div>
                                  <h5 className="text-xs font-bold text-slate-800">
                                    {cat.name}
                                  </h5>
                                  <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                                    {cat.description}
                                  </p>
                                </div>
                              </div>

                              <div className="text-right">
                                <span className="text-sm font-black text-slate-800">
                                  ฿{cat.amount.toLocaleString("th-TH", { maximumFractionDigits: 0 })}
                                </span>
                                <span
                                  className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-md ${cat.lightBgColor} ${cat.color}`}
                                >
                                  {cat.percentage}%
                                </span>
                              </div>
                            </div>

                            {/* Progress bar */}
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${cat.bgColor} rounded-full transition-all duration-300`}
                                style={{ width: `${Math.min(100, Math.max(3, cat.percentage))}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* AI Budget Insight Note */}
                    <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-xs flex items-start gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        {selectedPoint.isFuture ? (
                          <>
                            <span className="font-bold text-emerald-800">คำแนะนำงบประมาณ:</span> สัดส่วนเดือนนี้ประมาณการแบ่งเป็น{" "}
                            <span className="font-semibold text-slate-800">
                              {currentBreakdown.categories[0].name} ({currentBreakdown.categories[0].percentage}%)
                            </span>{" "}
                            และ{" "}
                            <span className="font-semibold text-slate-800">
                              {currentBreakdown.categories[1].name} ({currentBreakdown.categories[1].percentage}%)
                            </span>{" "}
                            แนะนำจัดสรรงบสำรองเบิกอะไหล่และแผนจัดหาครุภัณฑ์ทดแทนล่วงหน้า
                          </>
                        ) : (
                          <>
                            <span className="font-semibold text-slate-800">บันทึกประวัติจริง:</span> ยอดรวมรายจ่ายจริง ฿
                            {selectedPoint.cost.toLocaleString("th-TH", { maximumFractionDigits: 0 })} ประกอบด้วยค่าจัดซื้อครุภัณฑ์ใหม่ {currentBreakdown.categories[0].percentage}% และค่าซ่อมแซม/อะไหล่ {currentBreakdown.categories[1].percentage}%
                          </>
                        )}
                        {selectedSection === "all" && topSection && (
                          <span className="block mt-1.5 pt-1.5 border-t border-emerald-200/80 text-amber-800 font-medium">
                            🏆 แผนกที่มีค่าใช้จ่ายสะสมเยอะที่สุด: <b>{topSection.name}</b> (฿{topSection.total_cost.toLocaleString("th-TH", { maximumFractionDigits: 0 })})
                          </span>
                        )}
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    คลิกเลือกจุดบนกราฟเพื่อดูสัดส่วนประเภทรายจ่าย
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: MONTHLY SECTION RANKING */}
            {sideTab === "ranking" && (
              <div className="space-y-4">
                {isLoading ? (
                  <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                    <div className="w-7 h-7 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                    <p className="text-xs">กำลังคำนวณอันดับแผนกประจำเดือน...</p>
                  </div>
                ) : selectedPoint && monthlySectionRanking.length > 0 ? (
                  <>
                    {/* Selected Month Banner */}
                    <div className="bg-gradient-to-br from-amber-50/60 via-slate-50 to-emerald-50/40 p-4 rounded-xl border border-slate-200/70">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>{formatThaiMonth(selectedPoint.date)}</span>
                          </div>
                          <h4 className="text-xl font-black text-slate-800 mt-0.5">
                            ฿{selectedPoint.cost.toLocaleString("th-TH", { maximumFractionDigits: 0 })}
                          </h4>
                        </div>

                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                            selectedPoint.isFuture
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 font-bold"
                              : "bg-slate-100 text-slate-700 border-slate-200"
                          }`}
                        >
                          {selectedPoint.isFuture ? "ประมาณการ AI" : "ข้อมูลจริง"}
                        </span>
                      </div>

                      <div className="mt-2.5 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-xs">
                        <span className="text-slate-500">แผนกที่มีค่าใช้จ่ายมากที่สุด:</span>
                        <span className="font-bold text-amber-700 flex items-center gap-1">
                          <span>🏆</span>
                          {monthlySectionRanking[0]?.name}
                        </span>
                      </div>
                    </div>

                    {/* Notice if viewing a specific section */}
                    {selectedSection !== "all" && (
                      <div className="p-2.5 bg-amber-50/90 border border-amber-200 rounded-xl flex items-center justify-between gap-2 text-xs">
                        <span className="text-amber-900 text-[11px]">
                          กำลังกรองเฉพาะ <b>{forecastData?.section_name || "แผนกที่เลือก"}</b>
                        </span>
                        <button
                          onClick={() => setSelectedSection("all")}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer shrink-0 shadow-xs"
                        >
                          ดูภาพรวมทุกแผนก
                        </button>
                      </div>
                    )}

                    {/* Ranking Header */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800">
                        <Award className="w-4 h-4 text-amber-500" />
                        <span>อันดับแผนกที่ใช้จ่ายเยอะที่สุดในเดือนนี้</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">เรียงจากมากไปน้อย</span>
                    </div>

                    {/* Department Ranking Cards */}
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {monthlySectionRanking.map((sec) => {
                        const isCurrentSelected = selectedSection === sec.id;
                        return (
                          <div
                            key={sec.id}
                            onClick={() => setSelectedSection(sec.id)}
                            className={`p-3 rounded-xl border transition-all cursor-pointer group flex flex-col gap-2 ${
                              isCurrentSelected
                                ? "bg-emerald-50/90 border-emerald-400 shadow-xs ring-1 ring-emerald-300"
                                : "bg-white hover:bg-slate-50 border-slate-200/80 hover:border-emerald-300"
                            }`}
                            title={`คลิกเพื่อกรองดูกราฟเฉพาะ ${sec.name}`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span
                                  className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-black shrink-0 ${
                                    sec.rank === 1
                                      ? "bg-amber-100 text-amber-800 border border-amber-300 shadow-xs"
                                      : sec.rank === 2
                                        ? "bg-slate-200 text-slate-700 border border-slate-300"
                                        : sec.rank === 3
                                          ? "bg-orange-100 text-orange-800 border border-orange-300"
                                          : "bg-slate-100 text-slate-600 border border-slate-200"
                                  }`}
                                >
                                  {sec.rank === 1 ? "🥇" : sec.rank === 2 ? "🥈" : sec.rank === 3 ? "🥉" : sec.rank}
                                </span>
                                <div className="truncate">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold text-slate-800 group-hover:text-emerald-700 transition-colors truncate">
                                      {sec.name}
                                    </span>
                                    {isCurrentSelected && (
                                      <span className="text-[9px] bg-emerald-600 text-white px-1.5 py-0.2 rounded font-bold shrink-0">
                                        กำลังดู
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="text-right shrink-0 ml-2">
                                <span className="text-xs font-black text-slate-800 block">
                                  ฿{sec.amount.toLocaleString("th-TH", { maximumFractionDigits: 0 })}
                                </span>
                                <span className="text-[10px] font-bold text-emerald-600">
                                  {sec.percentage}%
                                </span>
                              </div>
                            </div>

                            {/* Progress bar */}
                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  sec.rank === 1
                                    ? "bg-amber-500"
                                    : sec.rank === 2
                                      ? "bg-emerald-600"
                                      : "bg-emerald-400"
                                }`}
                                style={{ width: `${Math.min(100, Math.max(5, sec.percentage))}%` }}
                              />
                            </div>

                            {/* Breakdown tags for this department */}
                            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                              <span>ค่าจัดซื้อ: ฿{sec.acquisitions.toLocaleString("th-TH", { maximumFractionDigits: 0 })}</span>
                              <span>ค่าซ่อม/อะไหล่: ฿{sec.repairs.toLocaleString("th-TH", { maximumFractionDigits: 0 })}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Summary Insight Note */}
                    <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs flex items-start gap-2">
                      <Award className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="text-[11px] text-slate-700 leading-relaxed">
                        <span className="font-bold text-amber-900">สรุปอันดับค่าใช้จ่าย:</span> ในเดือน {formatThaiMonth(selectedPoint.date)} แผนก{" "}
                        <span className="font-bold text-slate-900">{monthlySectionRanking[0]?.name}</span> มีงบประมาณสูงสุด (฿{monthlySectionRanking[0]?.amount.toLocaleString("th-TH", { maximumFractionDigits: 0 })}) คิดเป็น{" "}
                        <span className="font-bold text-amber-800">{monthlySectionRanking[0]?.percentage}%</span> ของงบประมาณโรงพยาบาลในเดือนนี้
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    คลิกเลือกจุดบนกราฟเพื่อดูอันดับแผนกประจำเดือน
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: ASSET LIFESPAN & REPLACEMENT BUDGET */}
            {sideTab === "lifespan" && (
              <div className="space-y-4">
                {isLoading ? (
                  <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                    <div className="w-7 h-7 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                    <p className="text-xs">กำลังวิเคราะห์อายุการใช้งานครุภัณฑ์...</p>
                  </div>
                ) : forecastData?.asset_lifespan ? (
                  <>
                    {/* Lifespan Alert Banner */}
                    <div className="p-4 bg-gradient-to-br from-rose-50/90 to-amber-50/50 rounded-xl border border-rose-200/80">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider">
                            ประเมินความเสี่ยงอายุขัยครุภัณฑ์
                          </span>
                          <h4 className="text-lg font-black text-rose-900 mt-0.5">
                            เกินอายุ {forecastData.asset_lifespan.exceeded_count} เครื่อง ({forecastData.asset_lifespan.exceeded_percentage}%)
                          </h4>
                          <p className="text-xs text-rose-700/90 mt-1">
                            จากครุภัณฑ์ที่ใช้งานอยู่ทั้งหมด {forecastData.asset_lifespan.total_active_assets} เครื่อง
                          </p>
                        </div>
                        <span className="px-2 py-1 bg-rose-100 text-rose-800 text-[11px] font-bold rounded-lg border border-rose-200">
                          เสี่ยงซ่อม x{forecastData.asset_lifespan.maintenance_risk_factor}
                        </span>
                      </div>

                      <div className="mt-3 pt-3 border-t border-rose-200/60 flex items-center justify-between text-xs">
                        <span className="text-slate-600 font-medium">งบที่ควรเตรียมจัดหาทดแทน:</span>
                        <span className="text-rose-800 font-extrabold text-sm">
                          ฿{forecastData.asset_lifespan.total_replacement_budget.toLocaleString("th-TH")}
                        </span>
                      </div>
                    </div>

                    {/* Types Breakdown */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-700 px-1">
                        <span>สรุปแยกตามประเภทครุภัณฑ์</span>
                        <span className="text-[11px] text-slate-400">เกณฑ์มาตรฐาน / งบทดแทน</span>
                      </div>

                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {forecastData.asset_lifespan.types_summary.map((t) => {
                          const pct = t.active_count > 0 ? Math.round((t.exceeded_count / t.active_count) * 100) : 0;
                          return (
                            <div
                              key={t.type_id}
                              className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all text-xs"
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="font-bold text-slate-800 truncate pr-2" title={t.type_name}>
                                  {t.type_name}
                                </span>
                                <span className="text-[11px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded font-medium shrink-0">
                                  เกณฑ์ {t.useful_life} ปี
                                </span>
                              </div>

                              <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
                                <span>
                                  เกินอายุ <b className="text-rose-600">{t.exceeded_count}</b> / {t.active_count} เครื่อง ({pct}%)
                                </span>
                                <span className="font-bold text-slate-700">
                                  ฿{t.replacement_value.toLocaleString("th-TH")}
                                </span>
                              </div>

                              {/* Progress bar */}
                              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all duration-500 ${
                                    pct > 70 ? "bg-rose-500" : pct > 40 ? "bg-amber-500" : "bg-emerald-500"
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Critical Asset Callout */}
                    {forecastData.asset_lifespan.critical_assets.length > 0 && (
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 text-xs">
                        <div className="flex items-center gap-1.5 font-bold text-slate-700 mb-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                          <span>เครื่องมูลค่าสูงที่ถึงอายุขัย</span>
                        </div>
                        <p className="text-[11px] text-slate-600 truncate">
                          {forecastData.asset_lifespan.critical_assets[0].name} ({forecastData.asset_lifespan.critical_assets[0].model})
                        </p>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1 pt-1 border-t border-slate-200/50">
                          <span>แผนก: {forecastData.asset_lifespan.critical_assets[0].section_name}</span>
                          <span className="font-bold text-rose-700">
                            ฿{forecastData.asset_lifespan.critical_assets[0].price.toLocaleString("th-TH")}
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    ไม่มีข้อมูลอายุการใช้งานครุภัณฑ์
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: PROJECTION TABLE */}
            {sideTab === "table" && (
              <div>
                <p className="text-xs text-slate-400 mb-3">
                  แจกแจงรายเดือนพร้อมกรอบสำรองความเสี่ยง (คลิกที่แถวเพื่อเลือกดูประเภทรายจ่าย)
                </p>

                <div className="overflow-y-auto max-h-80 pr-1">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3 rounded-l-lg">เดือน</th>
                        <th className="py-2.5 px-3">คาดการณ์</th>
                        <th className="py-2.5 px-3 rounded-r-lg">กรอบสำรอง</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {isLoading ? (
                        <tr>
                          <td colSpan={3} className="py-8 text-center text-slate-400">
                            กำลังโหลด...
                          </td>
                        </tr>
                      ) : forecastData?.ensemble?.map((item, i) => {
                        const isRowSelected = selectedPoint?.date === item.date;
                        return (
                          <tr
                            key={i}
                            onClick={() => {
                              setSelectedPoint({
                                date: item.date,
                                cost: item.forecast,
                                isFuture: true,
                                forecast: item.forecast,
                                lower: item.lower_bound,
                                upper: item.upper_bound,
                                repairs_cost: item.repairs_cost,
                                acquisitions_cost: item.acquisitions_cost,
                                section_rankings: item.section_rankings,
                                notes: item.notes,
                              });
                              if (sideTab === "table") {
                                setSideTab("breakdown");
                              }
                            }}
                            className={`cursor-pointer transition-colors ${
                              isRowSelected
                                ? "bg-emerald-50/80 font-semibold text-emerald-900"
                                : "hover:bg-slate-50"
                            }`}
                          >
                            <td className="py-2.5 px-3 font-semibold text-slate-700">
                              <span className="flex items-center gap-1.5">
                                <span
                                  className={`w-2 h-2 rounded-full ${
                                    isRowSelected ? "bg-emerald-600" : "bg-slate-300"
                                  }`}
                                />
                                {item.date}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-bold text-emerald-600">
                              ฿{item.forecast.toLocaleString("th-TH", { maximumFractionDigits: 0 })}
                            </td>
                            <td className="py-2.5 px-3 text-slate-500">
                              {item.upper_bound
                                ? `฿${item.upper_bound.toLocaleString("th-TH", { maximumFractionDigits: 0 })}`
                                : "-"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 mt-3 text-[11px] text-slate-400 text-center">
            {selectedPoint ? (
              sideTab === "breakdown"
                ? `กำลังแสดงสัดส่วนประเภทรายจ่ายของเดือน ${selectedPoint.date}`
                : sideTab === "ranking"
                ? `กำลังแสดงอันดับแผนกประจำเดือน ${selectedPoint.date}`
                : sideTab === "lifespan"
                ? "กำลังแสดงการวิเคราะห์ความเสี่ยงอายุขัยครุภัณฑ์ (useful_life)"
                : `ตารางสรุปคาดการณ์งบประมาณ ${predictionMonths} เดือน`
            ) : (
              "คลิกจุดใดก็ได้บนกราฟเพื่อเลือกเดือน"
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
