const VISIBLE_CONTENT_PATTERN = /[^\s\u00a0\u200b-\u200d\u2060\ufeff]/u;

export function hasVisibleEntryContent(content: string): boolean {
  return VISIBLE_CONTENT_PATTERN.test(content);
}
