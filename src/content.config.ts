import { defineCollection } from "astro:content";
import { glob, file } from "astro/loaders";

import {
  engineerFileSchema,
  industryTagSchema,
  projectFileSchema,
  roleSchema,
  techTagSchema,
} from "@/schemas";

const projects = defineCollection({
  loader: glob({ pattern: "*.yaml", base: "./private/projects" }),
  schema: projectFileSchema,
});

const engineer = defineCollection({
  loader: file("./private/engineer.yaml"),
  schema: engineerFileSchema,
});

const techTags = defineCollection({
  loader: file("./private/tech-tags.yaml"),
  schema: techTagSchema,
});

const industryTags = defineCollection({
  loader: file("./private/industry-tags.yaml"),
  schema: industryTagSchema,
});

const roles = defineCollection({
  loader: file("./private/roles.yaml"),
  schema: roleSchema,
});

export const collections = { projects, engineer, techTags, industryTags, roles };
