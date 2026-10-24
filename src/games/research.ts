import { z } from "zod";
import { gameFieldsSchema } from "./model";

const httpsUrl = z
  .string()
  .url()
  .max(2000)
  .refine((url) => url.startsWith("https://"), "Use an HTTPS URL.");

export const researchProposalSchema = gameFieldsSchema
  .pick({ title: true, release: true })
  .extend({
    source: httpsUrl,
    summary: z.string().trim().min(1).max(1500),
    covers: z
      .array(
        z.object({ url: httpsUrl, source: httpsUrl, label: z.string().min(1).max(160) }).strict(),
      )
      .max(3),
  })
  .strict();

export type ResearchProposal = z.infer<typeof researchProposalSchema>;
