"use client";

import { MobileReorderHintBar } from "./MobileReorderHintBar";
import { MobileReorderModeSwitcher } from "./MobileReorderModeSwitcher";
import { MobileReorderSwapBanner } from "./MobileReorderSwapBanner";
import type { MobileReorderMode } from "@/lib/mobile-reorder";

type Props = {
  mode: MobileReorderMode;
  onModeChange: (mode: MobileReorderMode) => void;
  hint: string;
  showSwapBanner?: boolean;
  swapBannerTitle?: string;
  onCancelSwap?: () => void;
};

export function MobileReorderToolbar({
  mode,
  onModeChange,
  hint,
  showSwapBanner,
  swapBannerTitle,
  onCancelSwap,
}: Props) {
  return (
    <>
      <div style={{ padding: "12px 16px 10px", borderBottom: "1px solid var(--divider-soft)" }}>
        <MobileReorderModeSwitcher mode={mode} onModeChange={onModeChange} />
      </div>
      <MobileReorderHintBar hint={hint} />
      {showSwapBanner && swapBannerTitle && onCancelSwap ? (
        <MobileReorderSwapBanner title={swapBannerTitle} onCancel={onCancelSwap} />
      ) : null}
    </>
  );
}
