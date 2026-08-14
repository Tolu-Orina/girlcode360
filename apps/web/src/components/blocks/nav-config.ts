import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  CalendarDays,
  HeartPulse,
  House,
  MessageCircle,
  ScanFace,
  Store,
  User,
  Users,
} from "lucide-react";

export type AppNavItem = {
  to: string;
  label: string;
  end?: boolean;
  icon: LucideIcon;
  lift?: number;
};

/** Phone tab bar — exactly five. Home sits in the middle of the arch. */
export const MOBILE_TABS: AppNavItem[] = [
  { to: "/app/cycle", label: "Cycle", icon: CalendarDays, lift: 0 },
  { to: "/app/mirror", label: "Mirror", icon: ScanFace, lift: 8 },
  { to: "/app", label: "Home", end: true, icon: House, lift: 12 },
  { to: "/app/alena", label: "Alena", icon: MessageCircle, lift: 8 },
  { to: "/app/account", label: "Account", icon: User, lift: 0 },
];

/** Desktop top nav. Health + Library are not in the phone bar. */
export const DESKTOP_TABS: AppNavItem[] = [
  { to: "/app", label: "Home", end: true, icon: House },
  { to: "/app/cycle", label: "Cycle", icon: CalendarDays },
  { to: "/app/health", label: "Health", icon: HeartPulse },
  { to: "/app/mirror", label: "Mirror", icon: ScanFace },
  { to: "/app/alena", label: "Alena", icon: MessageCircle },
  { to: "/app/library", label: "Library", icon: BookOpen },
  { to: "/app/community", label: "Community", icon: Users },
  { to: "/app/marketplace", label: "Marketplace", icon: Store },
  { to: "/app/account", label: "Account", icon: User },
];

/** Visible at `lg`; remainder goes in More until `xl`. */
export const DESKTOP_NAV_PRIMARY = DESKTOP_TABS.slice(0, 5);
export const DESKTOP_NAV_MORE = DESKTOP_TABS.slice(5);
