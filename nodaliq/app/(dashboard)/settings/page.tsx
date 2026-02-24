"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Save, BatteryCharging } from "lucide-react";

const NODES = ["HB_NORTH", "HB_SOUTH", "HB_WEST", "HB_HOUSTON"];

interface ProfileForm {
  name: string;
  capacityKwh: string;
  maxChargeKw: string;
  maxDischargeKw: string;
  roundTripEfficiency: string;
  minSoc: string;
  maxSoc: string;
  node: string;
}

const DEFAULT_FORM: ProfileForm = {
  name: "My Battery",
  capacityKwh: "1000",
  maxChargeKw: "250",
  maxDischargeKw: "250",
  roundTripEfficiency: "0.85",
  minSoc: "0.10",
  maxSoc: "0.95",
  node: "HB_NORTH",
};

export default function SettingsPage() {
  const [form, setForm] = useState<ProfileForm>(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.profile) {
          setForm({
            name: d.profile.name ?? DEFAULT_FORM.name,
            capacityKwh: String(d.profile.capacityKwh ?? DEFAULT_FORM.capacityKwh),
            maxChargeKw: String(d.profile.maxChargeKw ?? DEFAULT_FORM.maxChargeKw),
            maxDischargeKw: String(d.profile.maxDischargeKw ?? DEFAULT_FORM.maxDischargeKw),
            roundTripEfficiency: String(d.profile.roundTripEfficiency ?? DEFAULT_FORM.roundTripEfficiency),
            minSoc: String(d.profile.minSoc ?? DEFAULT_FORM.minSoc),
            maxSoc: String(d.profile.maxSoc ?? DEFAULT_FORM.maxSoc),
            node: d.profile.node ?? DEFAULT_FORM.node,
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  function set(key: keyof ProfileForm) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
      setSaved(false);
    };
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          capacityKwh: parseFloat(form.capacityKwh),
          maxChargeKw: parseFloat(form.maxChargeKw),
          maxDischargeKw: parseFloat(form.maxDischargeKw),
          roundTripEfficiency: parseFloat(form.roundTripEfficiency),
          minSoc: parseFloat(form.minSoc),
          maxSoc: parseFloat(form.maxSoc),
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Save failed");
        return;
      }
      setSaved(true);
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-zinc-400">
        <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
        Loading profile…
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="mt-1 text-sm text-zinc-400">Configure your battery asset and ERCOT node</p>
      </div>

      <form onSubmit={handleSave} className="max-w-2xl space-y-6">
        {/* Battery identity */}
        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-white">
              <BatteryCharging className="h-4 w-4 text-cyan-400" />
              Battery Profile
            </CardTitle>
            <CardDescription className="text-zinc-500">
              These values are passed to the LP optimizer and RL agent on every run.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-zinc-300">Profile Name</Label>
              <Input
                value={form.name}
                onChange={set("name")}
                placeholder="e.g. Site A – Megapack"
                className="border-zinc-700 bg-zinc-950 text-white placeholder:text-zinc-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-zinc-300">Capacity (kWh)</Label>
                <Input
                  type="number"
                  value={form.capacityKwh}
                  onChange={set("capacityKwh")}
                  min={1}
                  className="border-zinc-700 bg-zinc-950 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-300">Round-trip Efficiency</Label>
                <Input
                  type="number"
                  value={form.roundTripEfficiency}
                  onChange={set("roundTripEfficiency")}
                  min={0.5}
                  max={1}
                  step={0.01}
                  className="border-zinc-700 bg-zinc-950 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-300">Max Charge (kW)</Label>
                <Input
                  type="number"
                  value={form.maxChargeKw}
                  onChange={set("maxChargeKw")}
                  min={1}
                  className="border-zinc-700 bg-zinc-950 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-300">Max Discharge (kW)</Label>
                <Input
                  type="number"
                  value={form.maxDischargeKw}
                  onChange={set("maxDischargeKw")}
                  min={1}
                  className="border-zinc-700 bg-zinc-950 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-300">Min SOC</Label>
                <Input
                  type="number"
                  value={form.minSoc}
                  onChange={set("minSoc")}
                  min={0}
                  max={1}
                  step={0.01}
                  className="border-zinc-700 bg-zinc-950 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-300">Max SOC</Label>
                <Input
                  type="number"
                  value={form.maxSoc}
                  onChange={set("maxSoc")}
                  min={0}
                  max={1}
                  step={0.01}
                  className="border-zinc-700 bg-zinc-950 text-white"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ERCOT node */}
        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-white">ERCOT Hub Node</CardTitle>
            <CardDescription className="text-zinc-500">
              The hub node used for price ingestion and dispatch optimization.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select
              value={form.node}
              onValueChange={(v) => { setForm((f) => ({ ...f, node: v })); setSaved(false); }}
            >
              <SelectTrigger className="w-56 border-zinc-700 bg-zinc-950 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-zinc-700 bg-zinc-900 text-white">
                {NODES.map((n) => (
                  <SelectItem key={n} value={n} className="focus:bg-zinc-800">
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        <div className="flex items-center gap-3">
          <Button
            type="submit"
            disabled={saving}
            className="bg-cyan-600 hover:bg-cyan-500 text-white"
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {saving ? "Saving…" : "Save Profile"}
          </Button>
          {saved && <span className="text-sm text-emerald-400">Saved!</span>}
        </div>
      </form>
    </div>
  );
}
