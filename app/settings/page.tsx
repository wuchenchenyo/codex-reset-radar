import { SettingsForm } from "@/components/settings/settings-form";

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs tracking-[0.22em] text-muted-foreground uppercase">Preferences</p>
        <h1 className="mt-2 text-3xl font-medium tracking-tight">Settings</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          These stay on this device. They do not change Tibo monitoring and are independent of public reset events.
        </p>
      </div>
      <SettingsForm />
    </div>
  );
}
