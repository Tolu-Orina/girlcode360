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

/** Phone tab bar — exactly five, in a straight glass bar. Alena opens the panel. */
export const MOBILE_TABS: AppNavItem[] = [
  { to: "/app/cycle", label: "Cycle", icon: CalendarDays },
  { to: "/app/mirror", label: "Mirror", icon: ScanFace },
  { to: "/app", label: "Home", end: true, icon: House },
  { to: "__alena__", label: "Alena", icon: MessageCircle },
  { to: "/app/account", label: "Account", icon: User },
];

/** Desktop sidebar. Alena is a panel action, not a route. */
export const SIDEBAR_LINKS: AppNavItem[] = [
  { to: "/app", label: "Home", end: true, icon: House },
  { to: "/app/cycle", label: "Cycle", icon: CalendarDays },
  { to: "/app/health", label: "Health", icon: HeartPulse },
  { to: "/app/mirror", label: "Mirror", icon: ScanFace },
  { to: "/app/library", label: "Library", icon: BookOpen },
  { to: "/app/community", label: "Community", icon: Users },
  { to: "/app/marketplace", label: "Marketplace", icon: Store },
  { to: "/app/account", label: "Account", icon: User },
];

/** @deprecated desktop top nav — sidebar is the desktop pattern */
export const DESKTOP_TABS = SIDEBAR_LINKS;
export const DESKTOP_NAV_PRIMARY = SIDEBAR_LINKS.slice(0, 5);
export const DESKTOP_NAV_MORE = SIDEBAR_LINKS.slice(5);
