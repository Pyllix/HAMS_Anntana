import type { ReactNode } from "react";
import { useEmployeePhoto } from "../../hooks/useEmployeePhoto";

interface EmployeePhotoDisplayProps {
  userId: string | null | undefined;
  hasEmployeePhoto: boolean | undefined;
  photoRevision: string | null | undefined;
  alt: string;
  containerClassName: string;
  imageClassName: string;
  fallbackClassName: string;
  fallback: ReactNode;
  enabled?: boolean;
}

export default function EmployeePhotoDisplay({
  userId,
  hasEmployeePhoto,
  photoRevision,
  alt,
  containerClassName,
  imageClassName,
  fallbackClassName,
  fallback,
  enabled = true,
}: EmployeePhotoDisplayProps) {
  const photo = useEmployeePhoto(
    userId ?? "",
    hasEmployeePhoto,
    photoRevision,
    enabled && Boolean(userId),
  );

  if (photo.status === "ready") {
    return (
      <div className={containerClassName} data-photo-status="ready">
        <img src={photo.objectUrl} alt={alt} className={imageClassName} />
      </div>
    );
  }

  const statusLabel = photo.status === "error"
    ? `${alt}: โหลดรูปไม่สำเร็จ`
    : photo.status === "missing"
      ? `${alt}: ไม่มีรูป`
      : `${alt}: กำลังโหลดรูป`;

  return (
    <div
      className={containerClassName}
      role="img"
      aria-label={statusLabel}
      title={photo.status === "error" ? "โหลดรูปไม่สำเร็จ" : undefined}
      data-photo-status={photo.status}
    >
      <div className={fallbackClassName}>{fallback}</div>
      {photo.status === "error" && (
        <span
          aria-hidden="true"
          className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white ring-2 ring-white"
        >
          !
        </span>
      )}
    </div>
  );
}
