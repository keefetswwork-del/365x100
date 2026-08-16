import { CloudRequestError } from "@/lib/cloud-entry";
import type { PendingCloudSave, SaveEntryResult } from "@/types/cloud";

interface QueueCallbacks {
  onConflict: (input: PendingCloudSave, result: SaveEntryResult & { status: "conflict" }) => void;
  onError: () => void;
  onRetry: (delayMs: number) => void;
  onSaved: (result: SaveEntryResult & { status: "saved" }) => void;
  onSaving: () => void;
}

type SaveExecutor = (input: PendingCloudSave) => Promise<SaveEntryResult>;

export class CloudSaveQueue {
  private active = false;
  private readonly pendingByDate = new Map<string, PendingCloudSave>();
  private readonly pendingOrder: string[] = [];
  private retryAttempt = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(
    private readonly execute: SaveExecutor,
    private readonly callbacks: QueueCallbacks,
    private readonly retryBaseMs = 1000,
    private readonly maxRetries = 5,
  ) {}

  enqueue(input: PendingCloudSave): void {
    if (!this.pendingByDate.has(input.entryDate)) {
      this.pendingOrder.push(input.entryDate);
    }
    this.pendingByDate.set(input.entryDate, input);
    this.retryAttempt = 0;
    this.clearRetry();
    void this.drain();
  }

  retryNow(): void {
    if (this.pendingOrder.length === 0 || this.stopped) {
      return;
    }

    this.retryAttempt = 0;
    this.clearRetry();
    void this.drain();
  }

  stop(): void {
    this.stopped = true;
    this.pendingByDate.clear();
    this.pendingOrder.length = 0;
    this.clearRetry();
  }

  private clearRetry(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private async drain(): Promise<void> {
    const nextDate = this.pendingOrder[0];
    if (this.active || !nextDate || this.stopped || this.retryTimer) {
      return;
    }

    this.active = true;
    this.pendingOrder.shift();
    const input = this.pendingByDate.get(nextDate);
    this.pendingByDate.delete(nextDate);
    if (!input) {
      this.active = false;
      void this.drain();
      return;
    }
    this.callbacks.onSaving();

    try {
      const result = await this.execute(input);
      if (result.status === "conflict") {
        const conflictInput = this.pendingByDate.get(input.entryDate) ?? input;
        this.pendingByDate.delete(input.entryDate);
        const queuedIndex = this.pendingOrder.indexOf(input.entryDate);
        if (queuedIndex >= 0) this.pendingOrder.splice(queuedIndex, 1);
        this.callbacks.onConflict(conflictInput, result);
        return;
      }

      this.retryAttempt = 0;
      // TypeScript cannot observe that enqueue may run while the request is awaiting.
      const queuedAfterRequest = this.pendingByDate.get(result.entry.entryDate);
      if (queuedAfterRequest) {
        queuedAfterRequest.expectedVersion = result.entry.version;
      }
      this.callbacks.onSaved(result);
    } catch (error) {
      if (!this.pendingByDate.has(input.entryDate)) {
        this.pendingByDate.set(input.entryDate, input);
        this.pendingOrder.unshift(input.entryDate);
      }
      if (error instanceof CloudRequestError && !error.retryable) {
        this.callbacks.onError();
        return;
      }

      this.retryAttempt += 1;
      if (this.retryAttempt > this.maxRetries) {
        this.callbacks.onError();
        return;
      }

      const delay = Math.min(
        this.retryBaseMs * 2 ** (this.retryAttempt - 1),
        30000,
      );
      this.callbacks.onRetry(delay);
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        void this.drain();
      }, delay);
    } finally {
      this.active = false;
      if (!this.retryTimer && this.pendingOrder.length > 0 && this.retryAttempt === 0) {
        void this.drain();
      }
    }
  }
}
