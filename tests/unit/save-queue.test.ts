import { expect, test } from "@playwright/test";

import { CloudRequestError } from "../../lib/cloud-entry";
import { CloudSaveQueue } from "../../lib/save-queue";
import type { CloudEntry, PendingCloudSave } from "../../types/cloud";

function savedEntry(input: PendingCloudSave, version: number): CloudEntry {
  return {
    completedAt: null,
    content: input.content,
    createdAt: "2026-08-16T00:00:00.000Z",
    entryDate: input.entryDate,
    id: "entry-id",
    richContent: input.richContent,
    updatedAt: "2026-08-16T00:00:00.000Z",
    userId: "user-id",
    version,
    wordCount: input.wordCount,
  };
}

function input(content: string, expectedVersion = 1): PendingCloudSave {
  return {
    content,
    entryDate: "2026-08-16",
    expectedVersion,
    richContent: null,
    wordCount: content.split(" ").length,
  };
}

function datedInput(entryDate: string, content: string, expectedVersion = 1): PendingCloudSave {
  return { ...input(content, expectedVersion), entryDate };
}

test("coalesces active writes and carries the confirmed version forward", async () => {
  let releaseFirst: (() => void) | undefined;
  const firstGate = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  const calls: PendingCloudSave[] = [];
  const saved: string[] = [];
  const queue = new CloudSaveQueue(
    async (pending) => {
      calls.push({ ...pending });
      if (calls.length === 1) {
        await firstGate;
      }
      return {
        status: "saved" as const,
        entry: savedEntry(pending, pending.expectedVersion + 1),
      };
    },
    {
      onConflict: () => undefined,
      onError: () => undefined,
      onRetry: () => undefined,
      onSaved: (result) => saved.push(result.entry.content),
      onSaving: () => undefined,
    },
    1,
  );

  queue.enqueue(input("first"));
  await expect.poll(() => calls.length).toBe(1);
  queue.enqueue(input("latest"));
  releaseFirst?.();

  await expect.poll(() => calls.length).toBe(2);
  expect(calls[1]).toMatchObject({ content: "latest", expectedVersion: 2 });
  await expect.poll(() => saved).toEqual(["first", "latest"]);
  queue.stop();
});

test("retries temporary failures and preserves the pending content", async () => {
  let attempts = 0;
  const retryDelays: number[] = [];
  const queue = new CloudSaveQueue(
    async (pending) => {
      attempts += 1;
      if (attempts === 1) {
        throw new CloudRequestError("Temporary");
      }
      return { status: "saved", entry: savedEntry(pending, 2) };
    },
    {
      onConflict: () => undefined,
      onError: () => undefined,
      onRetry: (delay) => retryDelays.push(delay),
      onSaved: () => undefined,
      onSaving: () => undefined,
    },
    1,
  );

  queue.enqueue(input("safe offline draft"));
  await expect.poll(() => attempts).toBe(2);
  expect(retryDelays).toEqual([1]);
  queue.stop();
});

test("reports the newest coalesced content when the remote version conflicts", async () => {
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let reviewed: PendingCloudSave | null = null;
  const remote = savedEntry(input("remote"), 4);
  const queue = new CloudSaveQueue(
    async () => {
      await gate;
      return { status: "conflict", remote };
    },
    {
      onConflict: (pending) => {
        reviewed = pending;
      },
      onError: () => undefined,
      onRetry: () => undefined,
      onSaved: () => undefined,
      onSaving: () => undefined,
    },
    1,
  );

  queue.enqueue(input("first"));
  queue.enqueue(input("latest"));
  release?.();

  await expect.poll(() => reviewed).not.toBeNull();
  expect(reviewed).toMatchObject({ content: "latest" });
  queue.stop();
});

test("keeps the latest pending content for every date", async () => {
  let releaseFirst: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => { releaseFirst = resolve; });
  const calls: PendingCloudSave[] = [];
  const queue = new CloudSaveQueue(
    async (pending) => {
      calls.push({ ...pending });
      if (calls.length === 1) await gate;
      return { status: "saved", entry: savedEntry(pending, pending.expectedVersion + 1) };
    },
    {
      onConflict: () => undefined,
      onError: () => undefined,
      onRetry: () => undefined,
      onSaved: () => undefined,
      onSaving: () => undefined,
    },
    1,
  );

  queue.enqueue(datedInput("2026-08-15", "old first"));
  await expect.poll(() => calls.length).toBe(1);
  queue.enqueue(datedInput("2026-08-16", "today first"));
  queue.enqueue(datedInput("2026-08-15", "old latest"));
  queue.enqueue(datedInput("2026-08-16", "today latest"));
  releaseFirst?.();

  await expect.poll(() => calls.length).toBe(3);
  expect(calls.map((call) => [call.entryDate, call.content])).toEqual([
    ["2026-08-15", "old first"],
    ["2026-08-16", "today latest"],
    ["2026-08-15", "old latest"],
  ]);
  queue.stop();
});
