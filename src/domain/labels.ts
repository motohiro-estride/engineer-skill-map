import type { TechTagCategory, Visibility } from "@/schemas";

export const phaseLabels = {
  requirements: "要件定義",
  basicDesign: "基本設計",
  detailDesign: "詳細設計",
  implementation: "製造",
  test: "テスト",
  maintenance: "保守",
} as const;

export type PhaseKey = keyof typeof phaseLabels;

export const phaseOrder: PhaseKey[] = [
  "requirements",
  "basicDesign",
  "detailDesign",
  "implementation",
  "test",
  "maintenance",
];

export function phaseLabel(key: PhaseKey): string {
  return phaseLabels[key];
}

export function visibilityLabel(value: Visibility): string {
  switch (value) {
    case "default":
      return "公開";
    case "stats_only":
      return "統計のみ";
    case "archived":
      return "非表示";
  }
}

export function categoryLabel(value: TechTagCategory): string {
  return value;
}
