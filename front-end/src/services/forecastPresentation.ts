export type ForecastStatus =
  | 'disabled'
  | 'insufficient_data'
  | 'unavailable'
  | 'available';

export interface ForecastStatusCopy {
  title: string;
  message: string;
}

export interface ForecastKpis {
  total: number | null;
  average: number | null;
  peakMonth: string | null;
  peakValue: number | null;
}

export function getForecastStatusCopy(
  status: ForecastStatus,
): ForecastStatusCopy {
  switch (status) {
    case 'disabled':
      return {
        title: 'ปิดการพยากรณ์ด้วย Gemini',
        message:
          'ข้อมูลค่าใช้จ่ายย้อนหลังและการวิเคราะห์อายุครุภัณฑ์ยังดูได้ตามปกติ',
      };
    case 'insufficient_data':
      return {
        title: 'ข้อมูลย้อนหลังยังไม่เพียงพอ',
        message: 'ต้องมีข้อมูลอย่างน้อย 3 เดือนจึงจะเริ่มพยากรณ์ได้',
      };
    case 'unavailable':
      return {
        title: 'บริการพยากรณ์ยังไม่พร้อมใช้งาน',
        message:
          'ลองใหม่ภายหลังได้ ข้อมูลค่าใช้จ่ายย้อนหลังและการวิเคราะห์อายุครุภัณฑ์ยังดูได้ตามปกติ',
      };
    case 'available':
      return {
        title: 'ผลการพยากรณ์พร้อมใช้งาน',
        message: 'แสดงผลประมาณการจากข้อมูลที่ส่งไปประมวลผลตามการตั้งค่าระบบ',
      };
  }
}

export function calculateForecastKpis(
  forecasts: readonly { date: string; forecast: number }[],
): ForecastKpis {
  if (forecasts.length === 0) {
    return { total: null, average: null, peakMonth: null, peakValue: null };
  }

  const total = forecasts.reduce((sum, item) => sum + item.forecast, 0);
  const peak = forecasts.reduce((current, item) =>
    item.forecast > current.forecast ? item : current,
  );

  return {
    total,
    average: total / forecasts.length,
    peakMonth: peak.date,
    peakValue: peak.forecast,
  };
}

export function formatForecastValue(value: number | null): string {
  return value === null
    ? '—'
    : `฿${value.toLocaleString('th-TH', { maximumFractionDigits: 0 })}`;
}
