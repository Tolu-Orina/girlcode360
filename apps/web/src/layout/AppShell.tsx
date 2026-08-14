import { Outlet } from "react-router-dom";
import { AmbientLayer } from "@/components/blocks/ambient-layer";
import { AppHeader } from "@/components/blocks/app-header";
import { TabBar } from "@/components/blocks/tab-bar";
import { AppLock } from "@/components/AppLock";
import { InstallPrompt } from "@/components/InstallPrompt";

export function AppShell() {
  return (
    <AppLock>
      <div className="relative grid min-h-dvh grid-rows-[auto_auto_1fr] bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-[var(--radius)] focus:bg-card focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-primary focus:shadow-[var(--shadow-2)] focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Skip to main content
      </a>
      <AmbientLayer />
      <InstallPrompt />
      <AppHeader />
      <main
        className="relative z-10 mx-auto w-full max-w-[var(--shell-max)] px-4 py-6 pb-[calc(var(--tabbar-height)+env(safe-area-inset-bottom))] lg:px-8 lg:pb-8"
        id="main-content"
        tabIndex={-1}
      >
        <Outlet />
      </main>
      <TabBar />
      </div>
    </AppLock>
  );
}
