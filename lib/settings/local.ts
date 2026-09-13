import { DEFAULT_TIMEZONE } from "@/types";

export interface ClientSettings {
  timezone: string;
  weeklyResetAt: string | null;
  notificationsEnabled: boolean;
  browserNotifications: boolean;
  theme: "dark" | "light" | "system";
}

export const SETTINGS_KEY = "crr-settings";

export const defaultSettings: ClientSettings = {
  timezone: DEFAULT_TIMEZONE,
  weeklyResetAt: null,
  notificationsEnabled: true,
  browserNotifications: false,
  theme: "dark",
};

export function loadSettings(): ClientSettings {
  if (typeof window === "undefined") return defaultSettings;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings;
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(settings: ClientSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
