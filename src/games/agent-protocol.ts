import { z } from "zod";

export const thinkingLevelSchema = z.enum([
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
]);
const modelChoiceSchema = z.object({
  id: z.string(),
  name: z.string(),
  defaultThinking: thinkingLevelSchema,
  thinkingLevels: z.array(thinkingLevelSchema).min(1),
});
export type AgentModelChoice = z.infer<typeof modelChoiceSchema>;
const conversationId = z.number().int().positive().safe();
const conversation = { conversationId };
export const agentRequestSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("open"),
      key: z
        .string()
        .min(1)
        .max(100)
        .regex(/^[a-z0-9-]+$/),
    })
    .strict(),
  z
    .object({
      action: z.literal("send"),
      ...conversation,
      requestId: z.uuid(),
      text: z.string().trim().min(1).max(4000),
      draft: z
        .object({
          title: z.string().max(160),
          release: z.string().max(160),
          source: z.string().max(2000),
        })
        .strict()
        .nullable(),
      collection: z.array(z.string().max(160)).max(1000),
    })
    .strict(),
  z
    .object({
      action: z.literal("configure"),
      ...conversation,
      model: z.string().min(1).max(200),
      thinkingLevel: thinkingLevelSchema,
    })
    .strict(),
  z.object({ action: z.literal("stop"), ...conversation }).strict(),
  z.object({ action: z.literal("reset"), ...conversation }).strict(),
  z
    .object({
      action: z.literal("cover"),
      ...conversation,
      toolId: z.string().min(1).max(200),
      index: z.number().int().min(0).max(2),
    })
    .strict(),
]);
export type AgentRequest = z.infer<typeof agentRequestSchema>;

export const agentSnapshotSchema = z.object({
  conversationId,
  model: z.string(),
  thinkingLevel: thinkingLevelSchema,
  models: z.array(modelChoiceSchema).min(1),
  unavailableModels: z.array(z.string()),
  busy: z.boolean(),
  error: z.string().optional(),
  messages: z.array(
    z.object({
      id: z.string(),
      role: z.enum(["user", "assistant"]),
      text: z.string(),
      tools: z
        .array(
          z.object({
            id: z.string(),
            name: z.string(),
            label: z.string(),
            status: z.enum(["running", "complete", "error"]),
            output: z.string().optional(),
            data: z.unknown().optional(),
          }),
        )
        .optional(),
    }),
  ),
});
export type AgentSnapshot = z.infer<typeof agentSnapshotSchema>;
