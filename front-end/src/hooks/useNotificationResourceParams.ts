import { useSearchParams } from "react-router-dom";
import {
  NOTIFICATION_RESOURCE_ID_PARAM,
  NOTIFICATION_RESOURCE_TYPE_PARAM,
  NOTIFICATION_TYPE_PARAM,
  readNotificationResourceParams,
  readNotificationTypeParam,
} from "../services/notificationTargets";

// อ่าน/ล้าง query string ที่กระดิ่งแจ้งเตือนใส่มาให้ตอนนำทาง
export function useNotificationResourceParams() {
  const [searchParams, setSearchParams] = useSearchParams();
  const resource = readNotificationResourceParams(searchParams);
  const notificationType = readNotificationTypeParam(searchParams);
  const clear = () =>
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete(NOTIFICATION_RESOURCE_TYPE_PARAM);
        next.delete(NOTIFICATION_RESOURCE_ID_PARAM);
        next.delete(NOTIFICATION_TYPE_PARAM);
        return next;
      },
      { replace: true },
    );
  return { resource, notificationType, clear };
}
