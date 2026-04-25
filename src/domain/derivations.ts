import type { Period } from "@/schemas";

export function calculateAge(birthDate: string, asOf?: Date): number {
  const birth = new Date(birthDate);
  const now = asOf ?? new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

const ymToMonths = (ym: string): number => {
  const [y, m] = ym.split("-").map(Number);
  return y * 12 + m;
};

const formatYM = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
};

export function periodMonths(period: Period, asOf?: Date): number {
  const start = ymToMonths(period.start);
  const end = ymToMonths(period.end ?? formatYM(asOf ?? new Date()));
  return Math.max(end - start + 1, 0);
}

export function calculatePeriodLabel(period: Period, asOf?: Date): string {
  const months = periodMonths(period, asOf);
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m}ヶ月`;
  if (m === 0) return `${y}年`;
  return `${y}年${m}ヶ月`;
}

/** 全期間レンジで経験年数を算出 (MIN(start) 〜 MAX(end)) */
export function calculateExperienceYears(periods: Period[], asOf?: Date): number {
  if (periods.length === 0) return 0;
  const now = asOf ?? new Date();
  const starts = periods.map((p) => ymToMonths(p.start));
  const ends = periods.map((p) => ymToMonths(p.end ?? formatYM(now)));
  const months = Math.max(...ends) - Math.min(...starts) + 1;
  return Math.round((months / 12) * 10) / 10;
}

export function calculateTagCumulativeYears(
  baseName: string,
  projects: Array<{ techTagBaseNames: string[]; period: Period }>,
  asOf?: Date,
): number {
  const total = projects
    .filter((p) => p.techTagBaseNames.includes(baseName))
    .reduce((sum, p) => sum + periodMonths(p.period, asOf), 0);
  return Math.round((total / 12) * 10) / 10;
}

export function calculateTagProjectCount(
  baseName: string,
  projects: Array<{ techTagBaseNames: string[] }>,
): number {
  return projects.filter((p) => p.techTagBaseNames.includes(baseName)).length;
}
