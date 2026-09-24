import axios from "axios";
import type {
  CreateRepairDto,
  AssetApiResponse,
  AssetInfo,
} from "../types/TypeRepair";

const BASE_URL = "https://hams-anntana.onrender.com";

// Helper Function สำหรับสร้าง Authorization Header
function getHeaders() {
  const token = localStorage.getItem("token");
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
}

// Helper Function สำหรับแปลง Raw API Data เข้าสู่ UI Model
const mapAssetApiToInfo = (data: AssetApiResponse): AssetInfo => {
  const categoryName = data.type?.name || "ไม่ระบุหมวดหมู่";

  const locationName =
    [data.section?.name, data.section?.building].filter(Boolean).join(" ") ||
    "ไม่ระบุสถานที่";

  return {
    assetId: data.id,
    assetCode: data.noid,
    assetName: data.name,
    category: categoryName,
    location: locationName,
  };
};

export async function getAssetByCode(assetCode: string): Promise<AssetInfo> {
  try {
    const res = await axios.get(
      `${BASE_URL}/asset?search=${encodeURIComponent(assetCode.trim())}&limit=10`,
      getHeaders(),
    );

    const assetList: AssetApiResponse[] = res.data?.data ?? [];

    if (!assetList || assetList.length === 0) {
      throw new Error("ไม่พบข้อมูลครุภัณฑ์นี้ในระบบ");
    }

    const matchedAsset = assetList.find(
      (item) => item.noid?.toLowerCase() === assetCode.trim().toLowerCase(),
    );

    if (!matchedAsset) {
      throw new Error(`ไม่พบรหัสครุภัณฑ์ "${assetCode}" ในระบบ`);
    }

    return mapAssetApiToInfo(matchedAsset);
  } catch (error: any) {
    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }
    throw new Error(error.message || "เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
  }
}

export async function createRepairTicket(dto: CreateRepairDto): Promise<any> {
  try {
    const res = await axios.post(`${BASE_URL}/repairs`, dto, getHeaders());
    return res.data;
  } catch (error: any) {
    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }
    throw new Error("เกิดข้อผิดพลาดในการสร้างรายการแจ้งซ่อม");
  }
}
