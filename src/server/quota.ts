import { FieldValue, Firestore } from "@google-cloud/firestore";
import { AppError } from "./errors.js";
import type { AppConfig } from "./config.js";

export interface QuotaStore {
  reserveDaily(identity: string, pages: number, now?: Date): Promise<void>;
  reserveOcr(pages: number, now?: Date): Promise<void>;
  getMonthlyOcrUsage(now?: Date): Promise<number>;
}

interface DailyUsage { jobs: number; pages: number }

function dayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function monthKey(now: Date): string {
  return now.toISOString().slice(0, 7);
}

export class MemoryQuotaStore implements QuotaStore {
  private readonly daily = new Map<string, DailyUsage>();
  private readonly monthly = new Map<string, number>();

  constructor(private readonly config: Pick<AppConfig, "dailyJobLimit" | "dailyPageLimit" | "monthlyOcrPageCap">) {}

  async reserveDaily(identity: string, pages: number, now = new Date()): Promise<void> {
    const key = `${dayKey(now)}:${identity}`;
    const usage = this.daily.get(key) ?? { jobs: 0, pages: 0 };
    if (usage.jobs + 1 > this.config.dailyJobLimit) {
      throw new AppError("DAILY_JOB_LIMIT", "The daily limit of three translation jobs has been reached.", 429);
    }
    if (usage.pages + pages > this.config.dailyPageLimit) {
      throw new AppError("DAILY_PAGE_LIMIT", "The daily limit of 45 translated pages has been reached.", 429);
    }
    this.daily.set(key, { jobs: usage.jobs + 1, pages: usage.pages + pages });
  }

  async reserveOcr(pages: number, now = new Date()): Promise<void> {
    if (pages <= 0) return;
    const key = monthKey(now);
    const used = this.monthly.get(key) ?? 0;
    if (used + pages > this.config.monthlyOcrPageCap) {
      throw new AppError(
        "OCR_CAP_REACHED",
        "The monthly scanned-page allowance has been reached. PDFs with selectable text still work.",
        429,
      );
    }
    this.monthly.set(key, used + pages);
  }

  async getMonthlyOcrUsage(now = new Date()): Promise<number> {
    return this.monthly.get(monthKey(now)) ?? 0;
  }
}

export class FirestoreQuotaStore implements QuotaStore {
  private readonly firestore: Firestore;

  constructor(
    projectId: string,
    databaseId: string,
    private readonly config: Pick<AppConfig, "dailyJobLimit" | "dailyPageLimit" | "monthlyOcrPageCap">,
  ) {
    this.firestore = new Firestore({ projectId, databaseId });
  }

  async reserveDaily(identity: string, pages: number, now = new Date()): Promise<void> {
    const ref = this.firestore.collection("trangnguUsageDaily").doc(`${dayKey(now)}_${identity}`);
    await this.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const jobs = Number(snapshot.get("jobs") ?? 0);
      const usedPages = Number(snapshot.get("pages") ?? 0);
      if (jobs + 1 > this.config.dailyJobLimit) {
        throw new AppError("DAILY_JOB_LIMIT", "The daily limit of three translation jobs has been reached.", 429);
      }
      if (usedPages + pages > this.config.dailyPageLimit) {
        throw new AppError("DAILY_PAGE_LIMIT", "The daily limit of 45 translated pages has been reached.", 429);
      }
      transaction.set(ref, {
        jobs: jobs + 1,
        pages: usedPages + pages,
        day: dayKey(now),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
  }

  async reserveOcr(pages: number, now = new Date()): Promise<void> {
    if (pages <= 0) return;
    const key = monthKey(now);
    const ref = this.firestore.collection("trangnguUsageMonthly").doc(`${key}_ocr`);
    await this.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const used = Number(snapshot.get("pages") ?? 0);
      if (used + pages > this.config.monthlyOcrPageCap) {
        throw new AppError(
          "OCR_CAP_REACHED",
          "The monthly scanned-page allowance has been reached. PDFs with selectable text still work.",
          429,
        );
      }
      transaction.set(ref, {
        pages: used + pages,
        month: key,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
  }

  async getMonthlyOcrUsage(now = new Date()): Promise<number> {
    const snapshot = await this.firestore.collection("trangnguUsageMonthly").doc(`${monthKey(now)}_ocr`).get();
    return Math.max(0, Math.trunc(Number(snapshot.get("pages") ?? 0)));
  }
}

export function createQuotaStore(config: AppConfig): QuotaStore {
  if (config.nodeEnv === "production" && config.googleCloudProject) {
    return new FirestoreQuotaStore(config.googleCloudProject, config.firestoreDatabaseId, config);
  }
  return new MemoryQuotaStore(config);
}
