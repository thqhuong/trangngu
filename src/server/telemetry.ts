import { FieldValue, Firestore } from "@google-cloud/firestore";
import type { AppConfig } from "./config.js";

export interface DailyMetric {
  date: string;
  jobsReceived: number;
  jobsCompleted: number;
  jobsFailed: number;
  pagesTranslated: number;
  ocrPages: number;
  exportsCompleted: number;
  exportsFailed: number;
  pagesExported: number;
  geminiQuotaErrors: number;
  providerErrors: number;
}

export type MetricDelta = Partial<Omit<DailyMetric, "date">>;

export interface TelemetryStore {
  record(delta: MetricDelta, now?: Date): Promise<void>;
  getDaily(days: number, now?: Date): Promise<DailyMetric[]>;
}

const metricKeys = [
  "jobsReceived",
  "jobsCompleted",
  "jobsFailed",
  "pagesTranslated",
  "ocrPages",
  "exportsCompleted",
  "exportsFailed",
  "pagesExported",
  "geminiQuotaErrors",
  "providerErrors",
] as const satisfies ReadonlyArray<keyof MetricDelta>;

function dateKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function recentDateKeys(days: number, now: Date): string[] {
  const safeDays = Math.max(1, Math.min(31, Math.trunc(days)));
  return Array.from({ length: safeDays }, (_, index) => {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() - index);
    return dateKey(date);
  });
}

function emptyMetric(date: string): DailyMetric {
  return {
    date,
    jobsReceived: 0,
    jobsCompleted: 0,
    jobsFailed: 0,
    pagesTranslated: 0,
    ocrPages: 0,
    exportsCompleted: 0,
    exportsFailed: 0,
    pagesExported: 0,
    geminiQuotaErrors: 0,
    providerErrors: 0,
  };
}

function normalizeMetric(date: string, value: Record<string, unknown> | undefined): DailyMetric {
  const metric = emptyMetric(date);
  for (const key of metricKeys) {
    const number = Number(value?.[key] ?? 0);
    metric[key] = Number.isFinite(number) && number > 0 ? Math.trunc(number) : 0;
  }
  return metric;
}

export class MemoryTelemetryStore implements TelemetryStore {
  private readonly daily = new Map<string, DailyMetric>();

  async record(delta: MetricDelta, now = new Date()): Promise<void> {
    const key = dateKey(now);
    const metric = this.daily.get(key) ?? emptyMetric(key);
    for (const field of metricKeys) {
      const increment = Number(delta[field] ?? 0);
      if (Number.isFinite(increment) && increment > 0) metric[field] += Math.trunc(increment);
    }
    this.daily.set(key, metric);
  }

  async getDaily(days: number, now = new Date()): Promise<DailyMetric[]> {
    return recentDateKeys(days, now).map((key) => ({ ...(this.daily.get(key) ?? emptyMetric(key)) }));
  }
}

export class FirestoreTelemetryStore implements TelemetryStore {
  private readonly firestore: Firestore;

  constructor(projectId: string, databaseId: string) {
    this.firestore = new Firestore({ projectId, databaseId });
  }

  async record(delta: MetricDelta, now = new Date()): Promise<void> {
    const date = dateKey(now);
    const increments: Record<string, unknown> = { date, updatedAt: FieldValue.serverTimestamp() };
    for (const field of metricKeys) {
      const value = Number(delta[field] ?? 0);
      if (Number.isFinite(value) && value > 0) increments[field] = FieldValue.increment(Math.trunc(value));
    }
    await this.firestore.collection("trangnguMetricsDaily").doc(date).set(increments, { merge: true });
  }

  async getDaily(days: number, now = new Date()): Promise<DailyMetric[]> {
    const keys = recentDateKeys(days, now);
    const references = keys.map((key) => this.firestore.collection("trangnguMetricsDaily").doc(key));
    const snapshots = await this.firestore.getAll(...references);
    return snapshots.map((snapshot, index) => normalizeMetric(keys[index]!, snapshot.exists ? snapshot.data() : undefined));
  }
}

export function createTelemetryStore(config: AppConfig): TelemetryStore {
  if (config.nodeEnv === "production" && config.googleCloudProject) {
    return new FirestoreTelemetryStore(config.googleCloudProject, config.firestoreDatabaseId);
  }
  return new MemoryTelemetryStore();
}
