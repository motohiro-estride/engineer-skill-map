import yaml from "js-yaml";

export function dumpYaml(data: unknown): string {
  return yaml.dump(data, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    sortKeys: false,
    quotingType: '"',
    forceQuotes: false,
  });
}

export function parseYaml<T = unknown>(text: string): T {
  return yaml.load(text) as T;
}
