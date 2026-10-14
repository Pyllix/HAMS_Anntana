import { useEffect, useMemo, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useAuthStore } from "../stores/authStore";
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  openNotificationStream,
} from "../services/serverNotificationService";
import {
  createNotificationStream,
  type NotificationStreamStatus,
} from "../services/notificationStream";
import {
  findNotification,
  flattenNotificationPages,
  markAllReadInPages,
  markNotificationReadInPages,
  prependNotification,
  replaceNotificationInPages,
  unreadCountAfterCreated,
  type NotificationPages,
} from "../services/serverNotificationCache";
import { relatedQueryRoots } from "../services/notificationTargets";
import type { ServerNotification } from "../types/TypeServerNotification";

export const NOTIFICATION_PAGE_SIZE = 20;
const NOTIFICATION_QUERY_ROOT = "server-notifications";

// ผูก cache กับ userId เสมอ เพื่อไม่ให้ข้อมูลของบัญชีก่อนหน้าโผล่หลังสลับบัญชี
export const notificationQueryKeys = {
  list: (userId: string | undefined) => [NOTIFICATION_QUERY_ROOT, userId, "list"] as const,
  unreadCount: (userId: string | undefined) =>
    [NOTIFICATION_QUERY_ROOT, userId, "unread-count"] as const,
};

interface ReadContext {
  original?: ServerNotification;
}

export function useServerNotifications() {
  const userId = useAuthStore((state) => state.user?.id);
  const queryClient = useQueryClient();
  const [streamStatus, setStreamStatus] = useState<NotificationStreamStatus>("CONNECTING");
  const [actionError, setActionError] = useState("");
  const listKey = useMemo(() => notificationQueryKeys.list(userId), [userId]);
  const countKey = useMemo(() => notificationQueryKeys.unreadCount(userId), [userId]);

  const listQuery = useInfiniteQuery({
    queryKey: listKey,
    queryFn: ({ pageParam = 1 }) =>
      getNotifications(pageParam as number, NOTIFICATION_PAGE_SIZE),
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasNextPage ? lastPage.meta.page + 1 : undefined,
    enabled: Boolean(userId),
    staleTime: 15_000,
  });
  const unreadQuery = useQuery({
    queryKey: countKey,
    queryFn: getUnreadNotificationCount,
    enabled: Boolean(userId),
    staleTime: 10_000,
    // สำรองกรณี SSE หลุดนาน ปกติ SSE จะสั่ง sync ให้เองหลังต่อกลับ
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (!userId) return;

    const isActiveUser = () => useAuthStore.getState().user?.id === userId;
    const seenCreatedIds = new Set<string>();
    const sync = () => {
      if (!isActiveUser()) return;
      void queryClient.invalidateQueries({ queryKey: listKey });
      void queryClient.invalidateQueries({ queryKey: countKey });
    };

    const connection = createNotificationStream({
      open: openNotificationStream,
      onCreated: (notification) => {
        if (!isActiveUser() || seenCreatedIds.has(notification.id)) return;
        seenCreatedIds.add(notification.id);
        const list = queryClient.getQueryData<NotificationPages>(listKey);
        queryClient.setQueryData<number | undefined>(countKey, (count) =>
          unreadCountAfterCreated(count, list, notification),
        );
        if (list) {
          queryClient.setQueryData<NotificationPages | undefined>(listKey, (data) =>
            prependNotification(data, notification),
          );
        } else {
          void queryClient.invalidateQueries({ queryKey: listKey });
        }
        // refresh รายการ/รายละเอียดที่เกี่ยวข้อง (invalidate จะ refetch เฉพาะ query ที่หน้าจอเปิดใช้อยู่)
        for (const root of [...relatedQueryRoots(notification.resourceType), "notification-resource"]) {
          void queryClient.invalidateQueries({ queryKey: [root] });
        }
      },
      onSyncRequired: sync,
      onChanged: sync,
      onStatusChange: setStreamStatus,
    });
    const handleOnline = () => connection.reconnectNow();
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("online", handleOnline);
      connection.close();
    };
  }, [countKey, listKey, queryClient, userId]);

  const readMutation = useMutation<ServerNotification, unknown, string, ReadContext>({
    mutationFn: markNotificationRead,
    onMutate: async (id) => {
      setActionError("");
      await queryClient.cancelQueries({ queryKey: listKey });
      await queryClient.cancelQueries({ queryKey: countKey });
      const original = findNotification(
        queryClient.getQueryData<NotificationPages>(listKey),
        id,
      );
      if (!original || original.readAt) return {};

      queryClient.setQueryData<NotificationPages | undefined>(listKey, (data) =>
        markNotificationReadInPages(data, id, new Date().toISOString()),
      );
      queryClient.setQueryData<number | undefined>(countKey, (count) =>
        count === undefined ? count : Math.max(0, count - 1),
      );
      return { original };
    },
    onError: (_error, _id, context) => {
      setActionError("ทำเครื่องหมายว่าอ่านแล้วไม่สำเร็จ กรุณาลองใหม่");
      const original = context?.original;
      if (!original) return;
      // rollback เฉพาะรายการนี้ ไม่ทับ snapshot ทั้งก้อน เพื่อไม่ให้รายการใหม่จาก SSE ระหว่างรอหายไป
      queryClient.setQueryData<NotificationPages | undefined>(listKey, (data) =>
        replaceNotificationInPages(data, original),
      );
      queryClient.setQueryData<number | undefined>(countKey, (count) =>
        count === undefined ? count : count + 1,
      );
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<NotificationPages | undefined>(listKey, (data) =>
        replaceNotificationInPages(data, updated),
      );
    },
  });

  const readAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onMutate: () => setActionError(""),
    onSuccess: async (result) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const readAt = result.readAt ?? new Date().toISOString();
      queryClient.setQueryData<NotificationPages | undefined>(listKey, (data) =>
        markAllReadInPages(data, readAt),
      );
      queryClient.setQueryData<number>(countKey, 0);
      // backend ใช้เวลาตัดรอบ รายการที่เข้ามาระหว่างรอจะยังไม่ถูกอ่าน จึง sync ตัวเลขอีกครั้ง
      void queryClient.invalidateQueries({ queryKey: countKey });
    },
    onError: () => setActionError("อ่านทั้งหมดไม่สำเร็จ กรุณาลองใหม่"),
  });

  const notifications = useMemo(
    () => flattenNotificationPages(listQuery.data),
    [listQuery.data],
  );

  return {
    notifications,
    unreadCount: unreadQuery.data ?? 0,
    isLoading: listQuery.isLoading,
    isError: listQuery.isError,
    retry: () => {
      void listQuery.refetch();
      void unreadQuery.refetch();
    },
    hasNextPage: Boolean(listQuery.hasNextPage),
    isFetchingNextPage: listQuery.isFetchingNextPage,
    fetchNextPage: () => void listQuery.fetchNextPage(),
    markRead: (id: string) => readMutation.mutate(id),
    markAllRead: () => readAllMutation.mutate(),
    isMarkingAllRead: readAllMutation.isLoading,
    actionError,
    streamStatus,
  };
}
