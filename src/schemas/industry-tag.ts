import { z } from "zod";

const publicIndustryTagSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
});

const selfOnlyIndustryTagSchema = z.object({
  memo: z.string().optional(),
});

export const industryTagSchema = z.object({
  public: publicIndustryTagSchema,
  selfOnly: selfOnlyIndustryTagSchema.optional(),
});

export type IndustryTag = z.infer<typeof industryTagSchema>;
