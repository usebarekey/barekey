import { v } from "convex/values";

export type CreateDeviceCodeArgs = {
  clientName: string | null;
};

export type CreatedDeviceCodeResult = {
  deviceCode: string;
  userCode: string;
  intervalSec: number;
  expiresInSec: number;
};

export const createDeviceCodeArgs = {
  clientName: v.union(v.string(), v.null()),
} as const;

export const createdDeviceCodeResultValidator = v.object({
  deviceCode: v.string(),
  userCode: v.string(),
  intervalSec: v.number(),
  expiresInSec: v.number(),
});
