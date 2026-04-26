// Astro Content Layer から取得したデータを Terminal 用に整形する。
// frontmatter で実行 → 結果を JSON で script 側に渡す前提のため、
// Map 等の serializable でない型は使わず、シンプルな配列・オブジェクトに変換する。

import { getCollection, getEntry } from "astro:content";
import { getBuildMode } from "@/config";
import {
  expandEngineer,
  expandProject,
  isProjectVisible,
  isProjectInStats,
  buildLookup,
  calculateAge,
  calculateExperienceYears,
  calculatePeriodLabel,
  calculateTagCumulativeYears,
  calculateTagProjectCount,
  phaseLabels,
  phaseOrder,
} from "@/domain";

export interface TerminalData {
  engineer: {
    name: string;
    age?: number;
    gender: string;
    nationality: string;
    finalEducation: string;
    workableArea: string;
    domainKnowledge: string;
    selfPr: string;
    qualifications: { name: string; acquiredYearMonth: string }[];
  } | null;
  projects: Array<{
    no: number;
    slug: string;
    name: string;
    periodStart: string;
    periodEnd: string | null;
    periodLabel: string;
    summary: string;
    roleName: string | null;
    techTags: string[];
    industryTags: string[];
    phases: string[];
    memo?: string;
  }>;
  techTags: Array<{
    baseName: string;
    category: string;
    cumulativeYears: number;
    projectCount: number;
  }>;
  industryCounts: Array<{ name: string; count: number }>;
  roleCounts: Array<{ name: string; count: number }>;
  phaseCounts: Array<{ key: string; label: string; count: number }>;
  experienceYears: number;
  totalProjectCount: number;
}

export async function collectTerminalData(): Promise<TerminalData> {
  const mode = getBuildMode();

  const engineerEntry = await getEntry("engineer", "me");
  const engineerExpanded = engineerEntry
    ? expandEngineer(engineerEntry.data, mode)
    : null;

  const projectEntries = await getCollection("projects");
  const techTagEntries = await getCollection("techTags");
  const industryTagEntries = await getCollection("industryTags");
  const roleEntries = await getCollection("roles");

  const techTagsLookup = buildLookup(
    techTagEntries.map((e) => ({ id: e.id, data: e.data })),
  );
  const industryTagsLookup = buildLookup(
    industryTagEntries.map((e) => ({ id: e.id, data: e.data })),
  );
  const rolesLookup = buildLookup(
    roleEntries.map((e) => ({ id: e.id, data: e.data })),
  );

  const allProjects = projectEntries.map((e) => ({
    ...expandProject(e.data, mode),
    slug: e.id,
  }));

  // period.start desc + 同期間時は slug ASC (= No 昇順) で安定化
  const visibleProjects = allProjects
    .filter((p) => isProjectVisible(p.visibility, mode))
    .sort((a, b) => {
      if (a.period.start !== b.period.start) {
        return a.period.start < b.period.start ? 1 : -1;
      }
      return parseInt(a.slug, 10) - parseInt(b.slug, 10);
    });

  const statsProjects = allProjects.filter((p) => isProjectInStats(p.visibility));

  // techTags 集計
  const projectsWithBaseNames = statsProjects.map((p) => ({
    techTagBaseNames: p.techTags
      .map((id) => techTagsLookup.get(id)?.public.baseName)
      .filter((n): n is string => Boolean(n)),
    period: p.period,
  }));

  const baseNameSeen = new Set<string>();
  const techTagsAggregated: TerminalData["techTags"] = [];
  for (const tag of techTagsLookup.values()) {
    const baseName = tag.public.baseName;
    if (baseNameSeen.has(baseName)) continue;
    baseNameSeen.add(baseName);
    const cumulativeYears = calculateTagCumulativeYears(
      baseName,
      projectsWithBaseNames,
    );
    const projectCount = calculateTagProjectCount(baseName, projectsWithBaseNames);
    if (cumulativeYears <= 0 && projectCount <= 0) continue;
    techTagsAggregated.push({
      baseName,
      category: tag.public.category,
      cumulativeYears,
      projectCount,
    });
  }
  techTagsAggregated.sort((a, b) => b.cumulativeYears - a.cumulativeYears);

  // industry 集計
  const industryCountMap = new Map<string, number>();
  for (const p of statsProjects) {
    for (const id of p.industryTags) {
      const tag = industryTagsLookup.get(id);
      if (!tag) continue;
      industryCountMap.set(
        tag.public.name,
        (industryCountMap.get(tag.public.name) ?? 0) + 1,
      );
    }
  }
  const industryCounts = Array.from(industryCountMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // role 集計
  const roleCounts = Array.from(rolesLookup.entries())
    .map(([id, role]) => ({
      name: role.public.name,
      rank: role.public.rank,
      count: statsProjects.filter((p) => p.role === id).length,
    }))
    .sort((a, b) => a.rank - b.rank)
    .map(({ name, count }) => ({ name, count }));

  // phase 集計
  const phaseCounts = phaseOrder.map((key) => ({
    key,
    label: phaseLabels[key],
    count: statsProjects.filter((p) => p.phases[key]).length,
  }));

  // 経験年数は「業界に居る期間」(暦レンジ) として archived も含める
  const experienceYears =
    allProjects.length > 0
      ? calculateExperienceYears(allProjects.map((p) => p.period))
      : 0;

  // engineer 整形
  let engineer: TerminalData["engineer"] = null;
  if (engineerExpanded) {
    engineer = {
      name: engineerExpanded.name,
      age: engineerExpanded.birthDate ? calculateAge(engineerExpanded.birthDate) : undefined,
      gender: engineerExpanded.gender,
      nationality: engineerExpanded.nationality,
      finalEducation: engineerExpanded.finalEducation,
      workableArea: engineerExpanded.workableArea,
      domainKnowledge: engineerExpanded.domainKnowledge,
      selfPr: engineerExpanded.selfPr,
      qualifications: engineerExpanded.qualifications,
    };
  }

  // projects 整形
  const projects = visibleProjects.map((p) => {
    const role = rolesLookup.get(p.role);
    const techTags = p.techTags
      .map((id) => techTagsLookup.get(id)?.public.name)
      .filter((n): n is string => Boolean(n));
    const industryTags = p.industryTags
      .map((id) => industryTagsLookup.get(id)?.public.name)
      .filter((n): n is string => Boolean(n));
    const phases = phaseOrder
      .filter((key) => p.phases[key])
      .map((key) => phaseLabels[key]);
    return {
      no: parseInt(p.slug, 10),
      slug: p.slug,
      name: p.name,
      periodStart: p.period.start,
      periodEnd: p.period.end,
      periodLabel: calculatePeriodLabel(p.period),
      summary: p.summary,
      roleName: role?.public.name ?? null,
      techTags,
      industryTags,
      phases,
      memo: p.memo,
    };
  });

  return {
    engineer,
    projects,
    techTags: techTagsAggregated,
    industryCounts,
    roleCounts,
    phaseCounts,
    experienceYears,
    totalProjectCount: statsProjects.length,
  };
}
