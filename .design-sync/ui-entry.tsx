// Barrel entry for the design-sync bundle. Re-exports only the presentational
// components/ui primitives that render standalone (no next/image, next-auth,
// or app-provider context). Coupled primitives (Avatar, FollowButton,
// ThemeToggle, WeekCalendar) are intentionally excluded — see .design-sync/NOTES.md.
export { ChartFMLogo } from "../components/ui/ChartFMLogo";
export { MovementBadge } from "../components/ui/MovementBadge";
export { PositionNumber } from "../components/ui/PositionNumber";
export { VideoClipCover } from "../components/ui/VideoClipCover";
export { Cover } from "../components/ui/Cover";
