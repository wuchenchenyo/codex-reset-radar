import { SiteHeader } from "@/components/layout/site-header";
import { NotificationWatcher } from "@/components/notifications/notification-watcher";

export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <NotificationWatcher />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">{children}</main>
    </div>
  );
}
