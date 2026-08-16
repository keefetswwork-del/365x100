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
  private pending: PendingCloudSave | null = null;
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
    this.pending = input;
    this.retryAttempt = 0;
    this.clearRetry();
    void this.drain();
  }

  retryNow(): void {
    if (!this.pending || this.stopped) {
      return;
    }

    this.retryAttempt = 0;
    this.clearRetry();
    void this.drain();
  }

  stop(): void {
    this.stopped = true;
    this.pending = null;
    this.clearRetry();
  }

  private clearRetry(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private async drain(): Promise<void> {
    if (this.active || !this.pending || this.stopped || this.retryTimer) {
      return;
    }

    this.active = true;
    const input = this.pending;
    this.pending = null;
    this.callbacks.onSaving();

    try {
      const result = await this.execute(input);
      if (result.status === "conflict") {
        const conflictInput = this.pending ?? input;
        this.pending = null;
        this.callbacks.onConflict(conflictInput, result);
        return;
      }

      this.retryAttempt = 0;
      // TypeScript cannot observe that enqueue may run while the request is awaiting.
      const queuedAfterRequest = this.pending as PendingCloudSave | null;
      if (queuedAfterRequest?.entryDate === result.entry.entryDate) {
        queuedAfterRequest.expectedVersion = result.entry.version;
      }
      this.callbacks.onSaved(result);
    } catch (error) {
      this.pending ??= input;
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
      if (!this.retryTimer && this.pending && this.retryAttempt === 0) {
        void this.drain();
      }
    }
  }
}
