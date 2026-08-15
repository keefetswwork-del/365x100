const WORD_PATTERN = /[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu;

export function countWords(text: string): number {
  return text.match(WORD_PATTERN)?.length ?? 0;
}
