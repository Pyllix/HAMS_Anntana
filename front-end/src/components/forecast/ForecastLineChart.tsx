import React, { useState, useMemo, useRef } from "react";
import { ExpenseBreakdown, SectionRankingItem } from "../../services/forecastService";

export interface DataPoint {
  date: string;
  cost: number;
  isFuture: boolean;
  forecast?: number;
  lower?: number;
  upper?: number;
  notes?: string;
  repairs_cost?: number;
  acquisitions_cost?: number;
  section_rankings?: SectionRankingItem[];
  breakdown?: ExpenseBreakdown;
}

export interface ForecastLineChartProps {
  history: Array<{
    date: string;
    cost: number;
    repairs_cost?: number;
    acquisitions_cost?: number;
    section_rankings?: SectionRankingItem[];
    breakdown?: ExpenseBreakdown;
  }>;
  ensemble: Array<{
    date: string;
    forecast: number;
    lower_bound?: number;
    upper_bound?: number;
    repairs_cost?: number;
    acquisitions_cost?: number;
    section_rankings?: SectionRankingItem[];
    notes?: string;
    breakdown?: ExpenseBreakdown;
  }>;
  isLoading?: boolean;
  selectedDate?: string | null;
  onSelectPoint?: (point: DataPoint) => void;
}

export default function ForecastLineChart({
  history = [],
  ensemble = [],
  isLoading = false,
  selectedDate = null,
  onSelectPoint,
}: ForecastLineChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<DataPoint | null>(null);
  const [showConfidenceBand, setShowConfidenceBand] = useState<boolean>(true);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // รวมข้อมูลประวัติและทำนายเข้าด้วยกัน
  const chartData = useMemo(() => {
    if (history.length === 0 && ensemble.length === 0) return null;

    const points: DataPoint[] = [
      ...history.map((h) => ({
        date: h.date,
        cost: h.cost,
        isFuture: false,
        forecast: h.cost,
        lower: h.cost,
        upper: h.cost,
        repairs_cost: h.repairs_cost,
        acquisitions_cost: h.acquisitions_cost,
        section_rankings: h.section_rankings,
      })),
      ...ensemble.map((e) => ({
        date: e.date,
        cost: e.forecast,
        isFuture: true,
        forecast: e.forecast,
        lower: e.lower_bound ?? e.forecast * 0.85,
        upper: e.upper_bound ?? e.forecast * 1.15,
        repairs_cost: e.repairs_cost,
        acquisitions_cost: e.acquisitions_cost,
        section_rankings: e.section_rankings,
        notes: e.notes,
      })),
    ];

    const allValues = [
      ...points.map((p) => p.cost),
      ...points.map((p) => p.upper ?? p.cost),
      ...points.map((p) => p.lower ?? p.cost),
    ];

    const maxVal = Math.max(...allValues, 1000);
    const minVal = Math.max(0, Math.min(...allValues) * 0.85);

    const yMax = Math.ceil((maxVal * 1.15) / 10000) * 10000;
    const yMin = Math.floor(minVal / 10000) * 10000;

    return { points, yMax, yMin, historyCount: history.length };
  }, [history, ensemble]);

  // มิติของ SVG กราฟ
  const width = 860;
  const height = 350;
  const padding = { top: 35, right: 35, bottom: 50, left: 75 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const getX = (index: number, total: number) => {
    if (total <= 1) return padding.left;
    return padding.left + (index / (total - 1)) * chartWidth;
  };

  const getY = (val: number, yMin: number, yMax: number) => {
    const range = yMax - yMin || 1;
    return padding.top + chartHeight - ((val - yMin) / range) * chartHeight;
  };

  // เส้นประวัติในอดีต (Solid Slate Line)
  const historyLinePath = useMemo(() => {
    if (!chartData || chartData.historyCount === 0) return "";
    const { points, yMin, yMax, historyCount } = chartData;
    const histPoints = points.slice(0, historyCount);

    return histPoints
      .map((p, i) => {
        const x = getX(i, points.length);
        const y = getY(p.cost, yMin, yMax);
        return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  }, [chartData]);

  // เส้นทำนายงบประมาณ (Emerald Line)
  const forecastLinePath = useMemo(() => {
    if (!chartData || ensemble.length === 0) return "";
    const { points, yMin, yMax, historyCount } = chartData;
    const startIndex = Math.max(0, historyCount - 1);
    const futureSlice = points.slice(startIndex);

    return futureSlice
      .map((p, i) => {
        const absoluteIndex = startIndex + i;
        const x = getX(absoluteIndex, points.length);
        const val = i === 0 ? p.cost : (p.forecast ?? p.cost);
        const y = getY(val, yMin, yMax);
        return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  }, [chartData, ensemble]);

  // พื้นที่แรเงาใต้เส้นทำนาย (Emerald Area Fill เหมือนใน Figma)
  const forecastAreaPath = useMemo(() => {
    if (!chartData || ensemble.length === 0) return "";
    const { points, yMin, yMax, historyCount } = chartData;
    const startIndex = Math.max(0, historyCount - 1);
    const futureSlice = points.slice(startIndex);
    if (futureSlice.length === 0) return "";

    const bottomY = getY(yMin, yMin, yMax);
    const firstX = getX(startIndex, points.length);
    const lastX = getX(startIndex + futureSlice.length - 1, points.length);

    let path = futureSlice
      .map((p, i) => {
        const absoluteIndex = startIndex + i;
        const x = getX(absoluteIndex, points.length);
        const val = i === 0 ? p.cost : (p.forecast ?? p.cost);
        const y = getY(val, yMin, yMax);
        return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");

    path += ` L ${lastX.toFixed(1)} ${bottomY.toFixed(1)} L ${firstX.toFixed(1)} ${bottomY.toFixed(1)} Z`;
    return path;
  }, [chartData, ensemble]);

  // แถบช่วงความคลาดเคลื่อน (Confidence Band)
  const confidenceBandPath = useMemo(() => {
    if (!chartData || ensemble.length === 0 || !showConfidenceBand) return "";
    const { points, yMin, yMax, historyCount } = chartData;
    const startIndex = Math.max(0, historyCount - 1);
    const futureSlice = points.slice(startIndex);

    const upperPoints = futureSlice.map((p, i) => {
      const absoluteIndex = startIndex + i;
      const x = getX(absoluteIndex, points.length);
      const y = getY(p.upper ?? p.cost, yMin, yMax);
      return { x, y };
    });

    const lowerPoints = futureSlice
      .map((p, i) => {
        const absoluteIndex = startIndex + i;
        const x = getX(absoluteIndex, points.length);
        const y = getY(p.lower ?? p.cost, yMin, yMax);
        return { x, y };
      })
      .reverse();

    if (upperPoints.length === 0) return "";

    let path = `M ${upperPoints[0].x.toFixed(1)} ${upperPoints[0].y.toFixed(1)}`;
    upperPoints.slice(1).forEach((pt) => {
      path += ` L ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
    });
    lowerPoints.forEach((pt) => {
      path += ` L ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
    });
    path += " Z";

    return path;
  }, [chartData, ensemble, showConfidenceBand]);

  // เส้นกริดแกน Y
  const yTicks = useMemo(() => {
    if (!chartData) return [];
    const { yMin, yMax } = chartData;
    const ticksCount = 5;
    const step = (yMax - yMin) / (ticksCount - 1);
    return Array.from({ length: ticksCount }).map((_, i) => {
      const val = yMin + step * i;
      const y = getY(val, yMin, yMax);
      return { val, y };
    });
  }, [chartData]);

  // ป้ายแกน X (แบ่งการแสดงผลให้ครอบคลุมทั้งประวัติศาสตร์ และอนาคตที่พยากรณ์อย่างชัดเจน)
  const xTicks = useMemo(() => {
    if (!chartData) return [];
    const { points, historyCount } = chartData;

    // ฝั่งประวัติศาสตร์ (ในอดีต)
    const histPoints = points.slice(0, historyCount);
    const histStep = Math.max(1, Math.ceil(histPoints.length / 6));
    const histTicks = histPoints
      .map((p, i) => ({ ...p, index: i, x: getX(i, points.length) }))
      .filter((_, i) => i % histStep === 0 || i === histPoints.length - 1);

    // ฝั่งพยากรณ์ (ในอนาคต: แสดงป้ายชื่อเดือนให้เห็นครบถ้วน ชัดเจน ไม่โดนกลืน)
    const futurePoints = points.slice(historyCount);
    const futureStep = futurePoints.length <= 4 ? 1 : futurePoints.length <= 8 ? 2 : 3;
    const futureTicks = futurePoints
      .map((p, i) => ({ ...p, index: historyCount + i, x: getX(historyCount + i, points.length) }))
      .filter((_, i) => i % futureStep === 0 || i === futurePoints.length - 1);

    return [...histTicks, ...futureTicks];
  }, [chartData]);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!chartData || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * width;

    const { points } = chartData;
    let closestIndex = 0;
    let minDistance = Infinity;

    points.forEach((_, i) => {
      const x = getX(i, points.length);
      const dist = Math.abs(x - mouseX);
      if (dist < minDistance) {
        minDistance = dist;
        closestIndex = i;
      }
    });

    setHoveredPoint(points[closestIndex]);
  };

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!chartData || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * width;

    const { points } = chartData;
    let closestIndex = 0;
    let minDistance = Infinity;

    points.forEach((_, i) => {
      const x = getX(i, points.length);
      const dist = Math.abs(x - mouseX);
      if (dist < minDistance) {
        minDistance = dist;
        closestIndex = i;
      }
    });

    if (points[closestIndex]) {
      onSelectPoint?.(points[closestIndex]);
    }
  };

  if (isLoading) {
    return (
      <div className="h-80 flex flex-col items-center justify-center text-slate-400">
        <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm font-medium">กำลังคำนวณและวาดกราฟงบประมาณ...</p>
      </div>
    );
  }

  if (!chartData || chartData.points.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-slate-400 text-sm">
        ไม่มีข้อมูลเพียงพอสำหรับแสดงกราฟเส้น
      </div>
    );
  }

  const { points, yMin, yMax, historyCount } = chartData;
  const splitX = getX(Math.max(0, historyCount - 1), points.length);

  return (
    <div className="w-full flex flex-col space-y-3">
      {/* Chart Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 text-xs">
        {/* Legend Indicator */}
        <div className="flex flex-wrap items-center gap-4 text-slate-700 font-medium px-2">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-1 bg-slate-800 rounded-full inline-block"></span>
            <span>ประวัติจริง ({historyCount} เดือน)</span>
          </div>

          <div className="flex items-center gap-1.5 text-emerald-700">
            <span className="w-3.5 h-1 border-b-2 border-dashed border-emerald-600 inline-block"></span>
            <span className="font-semibold">งบประมาณคาดการณ์</span>
          </div>
        </div>

        {/* Toggle Confidence Band */}
        <button
          onClick={() => setShowConfidenceBand((prev) => !prev)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border cursor-pointer ${
            showConfidenceBand
              ? "bg-emerald-50 text-emerald-700 border-emerald-200 font-medium"
              : "bg-white text-slate-400 border-slate-200"
          }`}
        >
          {showConfidenceBand ? "ซ่อนกรอบสำรอง" : "แสดงกรอบสำรอง"}
        </button>
      </div>

      {/* SVG Interactive Line Chart */}
      <div className="relative w-full overflow-hidden select-none bg-white rounded-xl">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto drop-shadow-sm cursor-pointer"
          onMouseMove={handleMouseMove}
          onClick={handleSvgClick}
          onMouseLeave={() => setHoveredPoint(null)}
        >
          <defs>
            <linearGradient id="confidenceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#059669" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#059669" stopOpacity="0.03" />
            </linearGradient>
            <linearGradient id="forecastAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#059669" stopOpacity="0.20" />
              <stop offset="100%" stopColor="#059669" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Horizontal Grid lines & Y-axis labels */}
          {yTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={padding.left}
                y1={tick.y}
                x2={width - padding.right}
                y2={tick.y}
                stroke="#f1f5f9"
                strokeWidth="1.2"
              />
              <text
                x={padding.left - 12}
                y={tick.y + 4}
                textAnchor="end"
                className="text-[11px] fill-slate-400 font-mono font-medium"
              >
                ฿{tick.val >= 1000 ? `${(tick.val / 1000).toFixed(0)}k` : tick.val}
              </text>
            </g>
          ))}

          {/* Vertical Divider Line */}
          {historyCount > 0 && ensemble.length > 0 && (
            <g>
              <line
                x1={splitX}
                y1={padding.top}
                x2={splitX}
                y2={padding.top + chartHeight}
                stroke="#cbd5e1"
                strokeDasharray="4 4"
                strokeWidth="1.5"
              />
              <text
                x={splitX}
                y={padding.top - 10}
                textAnchor="middle"
                className="text-[10px] fill-slate-500 font-bold tracking-wider"
              >
                จุดเริ่มพยากรณ์
              </text>
            </g>
          )}

          {/* Shaded Confidence Band */}
          {confidenceBandPath && (
            <path
              d={confidenceBandPath}
              fill="url(#confidenceGradient)"
              stroke="#6ee7b7"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          )}

          {/* Forecast Area Gradient (Emerald Tone Matching Figma Mockup) */}
          {forecastAreaPath && (
            <path
              d={forecastAreaPath}
              fill="url(#forecastAreaGradient)"
            />
          )}

          {/* Historical Line (Solid Slate) */}
          {historyLinePath && (
            <path
              d={historyLinePath}
              fill="none"
              stroke="#1e293b"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Forecast Line (Emerald #059669) */}
          {forecastLinePath && (
            <path
              d={forecastLinePath}
              fill="none"
              stroke="#059669"
              strokeWidth="3"
              strokeDasharray="6 4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Selected Point Vertical Guide Line & Top Pill (Dark Slate Pill #1F2937 from Figma) */}
          {selectedDate && (
            <g pointerEvents="none">
              {(() => {
                const idx = points.findIndex((p) => p.date === selectedDate);
                if (idx === -1) return null;
                const sp = points[idx];
                const x = getX(idx, points.length);
                const isFuture = sp.isFuture;
                return (
                  <>
                    <line
                      x1={x}
                      y1={padding.top - 6}
                      x2={x}
                      y2={padding.top + chartHeight}
                      stroke={isFuture ? "#059669" : "#1F2937"}
                      strokeWidth="1.8"
                      strokeDasharray="4 3"
                    />
                    <rect
                      x={x - 32}
                      y={padding.top - 28}
                      width={64}
                      height={22}
                      rx={6}
                      fill="#1F2937"
                    />
                    <text
                      x={x}
                      y={padding.top - 13}
                      textAnchor="middle"
                      className="text-[10px] fill-white font-bold"
                    >
                      {sp.date}
                    </text>
                  </>
                );
              })()}
            </g>
          )}

          {/* Historical Dots */}
          {points.map((p, i) => {
            if (p.isFuture) return null;
            const x = getX(i, points.length);
            const y = getY(p.cost, yMin, yMax);
            const isHovered = hoveredPoint?.date === p.date;
            const isSelected = selectedDate === p.date;
            return (
              <g
                key={`hist-${i}`}
                className="cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectPoint?.(p);
                }}
              >
                {/* Expand click hit area */}
                <circle cx={x} cy={y} r={14} fill="transparent" />

                {isSelected && (
                  <>
                    <circle
                      cx={x}
                      cy={y}
                      r={13}
                      fill="#0f172a"
                      fillOpacity={0.12}
                      stroke="#0f172a"
                      strokeWidth={2}
                      strokeDasharray="3 3"
                    />
                    <circle
                      cx={x}
                      cy={y}
                      r={18}
                      fill="none"
                      stroke="#0f172a"
                      strokeWidth={1}
                      strokeOpacity={0.25}
                    />
                  </>
                )}

                <circle
                  cx={x}
                  cy={y}
                  r={isSelected ? 7.5 : isHovered ? 6 : 3.5}
                  fill={isSelected ? "#0f172a" : "#1e293b"}
                  stroke="#ffffff"
                  strokeWidth={isSelected ? 3 : isHovered ? 2.5 : 1.5}
                  className="transition-all duration-150"
                />
              </g>
            );
          })}

          {/* Future Dots */}
          {points.map((p, i) => {
            if (!p.isFuture) return null;
            const x = getX(i, points.length);
            const y = getY(p.cost, yMin, yMax);
            const isHovered = hoveredPoint?.date === p.date;
            const isSelected = selectedDate === p.date;
            return (
              <g
                key={`future-${i}`}
                className="cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectPoint?.(p);
                }}
              >
                {/* Expand click hit area */}
                <circle cx={x} cy={y} r={14} fill="transparent" />

                {isSelected && (
                  <>
                    <circle
                      cx={x}
                      cy={y}
                      r={14}
                      fill="#059669"
                      fillOpacity={0.16}
                      stroke="#059669"
                      strokeWidth={2}
                      strokeDasharray="3 3"
                    />
                    <circle
                      cx={x}
                      cy={y}
                      r={20}
                      fill="none"
                      stroke="#059669"
                      strokeWidth={1}
                      strokeOpacity={0.35}
                    />
                  </>
                )}

                {/* White circle with emerald stroke matching Figma */}
                <circle
                  cx={x}
                  cy={y}
                  r={isSelected ? 7 : isHovered ? 6 : 4.5}
                  fill={isSelected ? "#059669" : "#ffffff"}
                  stroke="#059669"
                  strokeWidth={isSelected ? 3 : 2.5}
                  className="transition-all duration-150 shadow"
                />
              </g>
            );
          })}

          {/* Hover Crosshair Guide Line (only when not exact selected) */}
          {hoveredPoint && hoveredPoint.date !== selectedDate && (
            <g pointerEvents="none">
              {(() => {
                const idx = points.findIndex((p) => p.date === hoveredPoint.date);
                if (idx === -1) return null;
                const x = getX(idx, points.length);
                const y = getY(hoveredPoint.cost, yMin, yMax);
                return (
                  <>
                    <line
                      x1={x}
                      y1={padding.top}
                      x2={x}
                      y2={padding.top + chartHeight}
                      stroke="#64748b"
                      strokeWidth="1.2"
                      strokeDasharray="3 3"
                    />
                    <circle
                      cx={x}
                      cy={y}
                      r="8.5"
                      fill="none"
                      stroke={hoveredPoint.isFuture ? "#059669" : "#1e293b"}
                      strokeWidth="2.5"
                      className="animate-pulse"
                    />
                  </>
                );
              })()}
            </g>
          )}

          {/* X-axis Labels */}
          {xTicks.map((tick, i) => (
            <text
              key={i}
              x={tick.x}
              y={padding.top + chartHeight + 24}
              textAnchor="middle"
              className={`text-[10px] font-medium ${
                tick.date === selectedDate
                  ? "fill-emerald-700 font-extrabold text-[11px]"
                  : tick.isFuture
                    ? "fill-emerald-600 font-bold"
                    : "fill-slate-500"
              }`}
            >
              {tick.date}
            </text>
          ))}
        </svg>

        {/* Floating Tooltip Badge on Hover */}
        {hoveredPoint && (
          <div className="absolute top-2 right-4 bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-xl shadow-2xl border border-slate-700/60 text-xs pointer-events-none transition-all duration-150 space-y-1.5 min-w-[210px]">
            <div className="flex items-center justify-between gap-3 pb-1 border-b border-slate-800">
              <span className="font-bold text-slate-200">{hoveredPoint.date}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                  hoveredPoint.isFuture
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30"
                    : "bg-slate-500/20 text-slate-300 border border-slate-400/30"
                }`}
              >
                {hoveredPoint.isFuture ? "คาดการณ์" : "ข้อมูลจริง"}
              </span>
            </div>

            {hoveredPoint.isFuture ? (
              <div className="space-y-1 pt-0.5">
                <div className="flex justify-between items-center text-emerald-300">
                  <span>งบประมาณคาดการณ์:</span>
                  <span className="font-bold text-white">
                    ฿{hoveredPoint.cost.toLocaleString("th-TH")}
                  </span>
                </div>
                {hoveredPoint.upper && hoveredPoint.lower && (
                  <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800 flex justify-between">
                    <span>กรอบความเสี่ยง:</span>
                    <span>
                      ฿{hoveredPoint.lower.toLocaleString("th-TH")} - ฿{hoveredPoint.upper.toLocaleString("th-TH")}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-base font-bold text-slate-200">
                ฿{hoveredPoint.cost.toLocaleString("th-TH")}
              </div>
            )}
            <div className="text-[10px] text-slate-400 pt-0.5 italic border-t border-slate-800/80">
              คลิกเพื่อดูสัดส่วนประเภทรายจ่าย
            </div>
          </div>
        )}
      </div>

      {/* Guide Note */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
        <span>💡 คลิกที่จุดแต่ละจุดบนเส้นกราฟ เพื่อเปิดดูสัดส่วนประเภทรายจ่ายของเดือนนั้นที่พาเนลด้านขวา</span>
      </div>
    </div>
  );
}
