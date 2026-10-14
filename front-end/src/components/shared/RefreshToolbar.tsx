import type { ComponentProps } from "react";
import RefreshButton from "./RefreshButton";

type RefreshToolbarProps = ComponentProps<typeof RefreshButton>;

export default function RefreshToolbar(props: RefreshToolbarProps) {
  return (
    <div className="flex w-full shrink-0 justify-end" role="toolbar" aria-label="เครื่องมือรายการ">
      <RefreshButton {...props} />
    </div>
  );
}
