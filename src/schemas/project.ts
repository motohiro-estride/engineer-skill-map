import { z } from "zod";
import { periodSchema, visibilitySchema } from "./common";

const phasesSchema = z.object({
  requirements: z.boolean(),
  basicDesign: z.boolean(),
  detailDesign: z.boolean(),
  implementation: z.boolean(),
  test: z.boolean(),
  maintenance: z.boolean(),
});

const scaleSchema = z.object({
  total: z.number().int().positive(),
  team: z.number().int().positive(),
});

const detailsSchema = z.object({
  businessPurpose: z.string().optional(),
  systemOverview: z.string().optional(),
  contribution: z.string().optional(),
});

const publicProjectSchema = z.object({
  name: z.string(),
  company: z.string().optional(),
  period: periodSchema,
  summary: z.string(),
  role: z.string(),
  scale: scaleSchema.optional(),
  phases: phasesSchema,
  techTags: z.array(z.string()),
  industryTags: z.array(z.string()),
  parallel: z.boolean().default(false),
  details: detailsSchema.optional(),
});

const selfOnlyProjectSchema = z.object({
  memo: z.string().optional(),
});

export const projectFileSchema = z.object({
  visibility: visibilitySchema.default("default"),
  public: publicProjectSchema,
  selfOnly: selfOnlyProjectSchema.optional(),
});

export type ProjectFile = z.infer<typeof projectFileSchema>;
