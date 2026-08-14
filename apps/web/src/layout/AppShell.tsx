import { Outlet } from "react-router-dom";
import { AmbientLayer } from "@/components/blocks/ambient-layer";
import { AlenaHost } from "@/components/blocks/alena-panel";
import { AlenaProvider } from "@/components/blocks/alena-context";
import { AppHeader } from "@/components/blocks/app-header";
import { AppSidebar } from "@/components/blocks/app-sidebar";
import { TabBar } from "@/components/blocks/tab-bar";
import { AppLock } from "@/components/AppLock";
import { InstallPrompt } from "@/components/InstallPrompt";

export function AppShell() {
  return (
    <AppLock>
      <AlenaProvider>
        <div className="relative min-h-dvh max-w-full overflow-x-clip bg-background text-foreground lg:flex">
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-[var(--radius)] focus:bg-card focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-primary focus:shadow-[var(--shadow-2)] focus:outline-none focus:ring-2 focus:ring-ring"
          >
            Skip to main content
          </a>
          <AppSidebar />
          <div className="relative grid min-h-dvh min-w-0 max-w-full flex-1 grid-rows-[auto_1fr]">
            <AmbientLayer />
            <InstallPrompt />
            <AppHeader />
            <main
              className="relative z-10 min-w-0 w-full max-w-full overflow-x-clip px-4 py-6 pb-[calc(var(--tabbar-height)+env(safe-area-inset-bottom))] lg:px-8 lg:py-8 lg:pb-8"
              id="main-content"
              tabIndex={-1}
            >
              <Outlet />
            </main>
            <TabBar />
          </div>
          <AlenaHost />
        </div>
      </AlenaProvider>
    </AppLock>
  );
}
