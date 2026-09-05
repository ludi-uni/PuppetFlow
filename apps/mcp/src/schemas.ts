import type { StandardSchemaWithJSON } from "@modelcontextprotocol/server";
import { z } from "zod";

export type BridgeInputSchema = StandardSchemaWithJSON<unknown, unknown>;
export function bridgeInputSchema(schema: z.ZodType): BridgeInputSchema {
  return {
    "~standard": { ...schema["~standard"], validate: (value: unknown) => ({ value }) },
  };
}
export const actionRequestSchema = z
  .object({
    action: z.string().trim().min(1).max(128),
    side: z.enum(["left", "right", "both"]).optional(),
    intensity: z.number().finite().optional(),
    duration: z.number().finite().optional(),
    speed: z.number().finite().optional(),
    blendDuration: z.number().finite().optional(),
  })
  .strict();
export const actInputSchema = actionRequestSchema;
export const sequenceInputSchema = z
  .object({ actions: z.array(actionRequestSchema).min(1) })
  .strict();
export const lookAtInputSchema = z
  .object({
    target: z.enum(["camera", "left", "right", "up", "down"]),
    intensity: z.number().finite().optional(),
    duration: z.number().finite().optional(),
    speed: z.number().finite().optional(),
    blendDuration: z.number().finite().optional(),
  })
  .strict();
export const setExpressionInputSchema = z
  .object({
    expression: z.string().trim().min(1).max(128),
    intensity: z.number().finite().optional(),
    duration: z.number().finite().optional(),
    fadeIn: z.number().finite().optional(),
    fadeOut: z.number().finite().optional(),
  })
  .strict();
export const clearExpressionInputSchema = z
  .object({ fadeOut: z.number().finite().optional() })
  .strict();
export const emptyInputSchema = z.object({}).strict();
