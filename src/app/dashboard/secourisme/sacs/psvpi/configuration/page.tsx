"use client";

import {
  BriefcaseMedical,
  HeartPulse,
  PackagePlus,
} from "lucide-react";
import { useState } from "react";

import RescueBagConfiguration from "@/components/secourisme/sacs/RescueBagConfiguration";

type BagOption = {
  code: string;
  label: string;
  shortLabel: string;
  controlHref: string;
  icon: typeof BriefcaseMedical;
};

const BAGS: BagOption[] = [
  {
    code: "ps_vpi",
    label: "Premier secours VPI",
    shortLabel: "PS VPI",
    controlHref:
      "/dashboard/secourisme/sacs/psvpi",
    icon: BriefcaseMedical,
  },
  {
    code: "oxygenotherapie_vpi",
    label: "Oxygénothérapie VPI",
    shortLabel: "Oxy VPI",
    controlHref:
      "/dashboard/secourisme/sacs/oxygenotherapie",
    icon: HeartPulse,
  },
  {
    code: "ps_fpt",
    label: "Premier secours FPT",
    shortLabel: "PS FPT",
    controlHref:
      "/dashboard/secourisme/sacs/psfpt",
    icon: PackagePlus,
  },
];

export default function RescueBagsConfigurationPage() {
  const [
    selectedBagCode,
    setSelectedBagCode,
  ] = useState("ps_vpi");

  const selectedBag =
    BAGS.find(
      (bag) =>
        bag.code === selectedBagCode
    ) ?? BAGS[0];

  return (
    <div className="app-page min-h-screen">
      <div className="mx-auto w-full max-w-5xl px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8">
        <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
          <p className="px-2 pb-3 text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
            Sac à configurer
          </p>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {BAGS.map((bag) => {
              const Icon = bag.icon;
              const selected =
                bag.code ===
                selectedBag.code;

              return (
                <button
                  key={bag.code}
                  type="button"
                  onClick={() =>
                    setSelectedBagCode(
                      bag.code
                    )
                  }
                  className={`flex min-h-14 items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                    selected
                      ? "border-red-500 bg-red-600 text-white shadow-sm"
                      : "border-border bg-surface-strong hover:bg-accent"
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                      selected
                        ? "border-white/30 bg-white/10"
                        : "border-border bg-background"
                    }`}
                  >
                    <Icon
                      size={18}
                    />
                  </span>

                  <span className="min-w-0">
                    <span className="block text-sm font-black">
                      {bag.shortLabel}
                    </span>
                    <span
                      className={`mt-0.5 block truncate text-xs ${
                        selected
                          ? "text-white/80"
                          : "text-muted-foreground"
                      }`}
                    >
                      {bag.label}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <RescueBagConfiguration
        key={selectedBag.code}
        bagCode={selectedBag.code}
        controlHref={
          selectedBag.controlHref
        }
      />
    </div>
  );
}