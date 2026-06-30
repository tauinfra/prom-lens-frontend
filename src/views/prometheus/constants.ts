export const PROM_GROUP_TYPES = {
  ALERTING: "ALERTING RULES",
  RECORDING: "ALERTING RECORDS"
} as const;

export type PromGroupType =
  (typeof PROM_GROUP_TYPES)[keyof typeof PROM_GROUP_TYPES];
