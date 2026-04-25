import type { IndustryTag, Role, TechTag } from "@/schemas";

export type EntryWithId<T> = { id: string; data: T };

export function buildLookup<T>(entries: Array<EntryWithId<T>>): Map<string, T> {
  return new Map(entries.map((e) => [e.id, e.data]));
}

export function resolveRole(id: string, roles: Map<string, Role>): Role | undefined {
  return roles.get(id);
}

export function resolveTechTag(
  id: string,
  tags: Map<string, TechTag>,
): TechTag | undefined {
  return tags.get(id);
}

export function resolveTechTags(
  ids: string[],
  tags: Map<string, TechTag>,
): TechTag[] {
  return ids
    .map((id) => tags.get(id))
    .filter((t): t is TechTag => t !== undefined);
}

export function resolveIndustryTag(
  id: string,
  tags: Map<string, IndustryTag>,
): IndustryTag | undefined {
  return tags.get(id);
}

export function resolveIndustryTags(
  ids: string[],
  tags: Map<string, IndustryTag>,
): IndustryTag[] {
  return ids
    .map((id) => tags.get(id))
    .filter((t): t is IndustryTag => t !== undefined);
}
