"use client";

import { useState, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { defaultSettings, saveSettings, SETTINGS_KEY, type ClientSettings } from "@/lib/settings/local";
import { isValidTimeZone } from "@/lib/time/timezone";

function subscribeSettings(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function parseSettings(raw: string | null): ClientSettings {
  if (!raw) return defaultSettings;
  try {
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return defaultSettings;
  }
}

export function SettingsForm() {
  const { setTheme } = useTheme();
  const stored = useSyncExternalStore(
    subscribeSettings,
    () => window.localStorage.getItem(SETTINGS_KEY),
    () => null,
  );
  const persisted = parseSettings(stored);
  const [draft, setDraft] = useState<Partial<ClientSettings>>({});
  const [saved, setSaved] = useState(false);
  const settings = { ...persisted, ...draft };

  function update<K extends keyof ClientSettings>(key: K, value: ClientSettings[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  async function onSave() {
    if (!isValidTimeZone(settings.timezone)) return;
    saveSettings(settings);
    setTheme(settings.theme);
    if (settings.browserNotifications && typeof Notification !== "undefined") {
      await Notification.requestPermission();
    }
    setSaved(true);
  }

  return (
    <form
      className="max-w-xl space-y-6 rounded-xl border border-border/80 p-5"
      onSubmit={(event) => {
        event.preventDefault();
        void onSave();
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="timezone">Timezone</Label>
        <Input
          id="timezone"
          value={settings.timezone}
          onChange={(event) => update("timezone", event.target.value)}
        />
        <p className="text-xs text-muted-foreground">Default GMT+8 / Asia/Shanghai. Stored timestamps remain UTC.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="weekly">My weekly reset</Label>
        <Input
          id="weekly"
          type="datetime-local"
          value={settings.weeklyResetAt ? settings.weeklyResetAt.slice(0, 16) : ""}
          onChange={(event) =>
            update("weeklyResetAt", event.target.value ? new Date(event.target.value).toISOString() : null)
          }
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="theme">Theme</Label>
        <select
          id="theme"
          className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
          value={settings.theme}
          onChange={(event) => update("theme", event.target.value as ClientSettings["theme"])}
        >
          <option value="dark">Dark</option>
          <option value="light">Light</option>
          <option value="system">System</option>
        </select>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm">Notifications</p>
          <p className="text-xs text-muted-foreground">Polling interval display: every 5 minutes via cron.</p>
        </div>
        <Switch
          checked={settings.notificationsEnabled}
          onCheckedChange={(value) => update("notificationsEnabled", value)}
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm">Browser notifications</p>
          <p className="text-xs text-muted-foreground">Uses the Notification API while this site is open.</p>
        </div>
        <Switch
          checked={settings.browserNotifications}
          onCheckedChange={(value) => update("browserNotifications", value)}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit">Save</Button>
        {saved ? <p className="text-sm text-muted-foreground">Saved on this device.</p> : null}
      </div>
    </form>
  );
}
