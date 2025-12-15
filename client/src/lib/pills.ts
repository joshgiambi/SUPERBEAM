import { cn } from "@/lib/utils";

export type PillTone = "subtle" | "vibrant";

export type PillColor =
  | "blue"
  | "cyan"
  | "purple"
  | "green"
  | "emerald"
  | "amber"
  | "orange"
  | "gray";

const PILL_BASE =
  "inline-flex items-center h-6 px-2.5 py-0 whitespace-nowrap rounded-full font-semibold text-[10px] border backdrop-blur-sm";

const SUBTLE: Record<PillColor, string> = {
  // More subdued fill + brighter border for readability on dark backgrounds
  blue: "bg-blue-950/35 text-blue-200 border-blue-500/55",
  cyan: "bg-cyan-950/35 text-cyan-200 border-cyan-500/55",
  purple: "bg-purple-950/35 text-purple-200 border-purple-500/55",
  green: "bg-green-950/35 text-green-200 border-green-500/55",
  emerald: "bg-emerald-950/35 text-emerald-200 border-emerald-500/55",
  amber: "bg-amber-950/35 text-amber-200 border-amber-500/55",
  orange: "bg-orange-950/35 text-orange-200 border-orange-500/55",
  gray: "bg-gray-950/30 text-gray-200 border-gray-500/50",
};

const VIBRANT: Record<PillColor, string> = {
  blue: "bg-blue-600/80 text-white border-blue-400/60",
  cyan: "bg-cyan-600/80 text-white border-cyan-400/60",
  purple: "bg-purple-600/80 text-white border-purple-400/60",
  green: "bg-green-600/80 text-white border-green-400/60",
  emerald: "bg-emerald-600/80 text-white border-emerald-400/60",
  amber: "bg-amber-600/80 text-white border-amber-400/60",
  orange: "bg-orange-600/80 text-white border-orange-400/60",
  gray: "bg-gray-700/70 text-gray-100 border-gray-500/60",
};

export function pillClass(
  color: PillColor,
  tone: PillTone = "subtle",
  className?: string,
) {
  return cn(PILL_BASE, tone === "vibrant" ? VIBRANT[color] : SUBTLE[color], className);
}

export function pillClassForModality(modality?: string | null, tone: PillTone = "subtle") {
  const m = (modality || "").toUpperCase();
  if (m === "CT") return pillClass("blue", tone);
  if (m === "MR" || m === "MRI") return pillClass("purple", tone);
  if (m === "PT" || m === "PET" || m === "NM") return pillClass("amber", tone);
  if (m === "RT" || m === "RTSTRUCT") return pillClass("green", tone);
  if (m === "REG") return pillClass("cyan", tone);
  return pillClass("gray", tone);
}


