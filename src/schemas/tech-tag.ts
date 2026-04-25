import { z } from "zod";

export const techTagCategorySchema = z.enum([
  "Language",
  "Framework",
  "OS",
  "Middleware",
  "Database",
  "Tool",
  "Cloud",
]);
export type TechTagCategory = z.infer<typeof techTagCategorySchema>;

const publicTechTagSchema = z.object({
  name: z.string(),
  baseName: z.string(),
  category: techTagCategorySchema,
});

const selfOnlyTechTagSchema = z.object({
  memo: z.string().optional(),
});

export const techTagSchema = z.object({
  public: publicTechTagSchema,
  selfOnly: selfOnlyTechTagSchema.optional(),
});

export type TechTag = z.infer<typeof techTagSchema>;
