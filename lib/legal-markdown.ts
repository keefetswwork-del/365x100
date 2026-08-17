export type LegalInline =
  | { kind: "text"; text: string }
  | { kind: "emphasis"; text: string }
  | { href: string; kind: "link"; text: string };

export type LegalBlock =
  | { id: string; kind: "heading"; level: 1 | 2; text: string }
  | { content: LegalInline[]; kind: "paragraph" }
  | { items: LegalInline[][]; kind: "list" };

export type LegalDocument = {
  blocks: LegalBlock[];
  effectiveDate: string;
  sections: Array<{ id: string; text: string }>;
  title: string;
};

const INLINE_PATTERN = /\*\*([^*\n]+)\*\*|\[([^\]\n]+)\]\(([^)\s]+)\)/g;

function safeLegalHref(href: string): boolean {
  return href === "/privacy"
    || href === "/terms"
    || /^mailto:[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(href);
}

function parseInline(value: string, sourceName: string): LegalInline[] {
  const tokens: LegalInline[] = [];
  let cursor = 0;

  for (const match of value.matchAll(INLINE_PATTERN)) {
    const index = match.index ?? 0;
    if (index > cursor) tokens.push({ kind: "text", text: value.slice(cursor, index) });

    if (match[1]) {
      tokens.push({ kind: "emphasis", text: match[1] });
    } else {
      const href = match[3];
      if (!safeLegalHref(href)) {
        throw new Error(`${sourceName} contains an unsafe legal-document link.`);
      }
      tokens.push({ href, kind: "link", text: match[2] });
    }
    cursor = index + match[0].length;
  }

  if (cursor < value.length) tokens.push({ kind: "text", text: value.slice(cursor) });

  const unparsedText = tokens
    .filter((token): token is Extract<LegalInline, { kind: "text" }> => token.kind === "text")
    .map((token) => token.text)
    .join("");
  if (unparsedText.includes("**") || /\[[^\]]*\]\(/.test(unparsedText)) {
    throw new Error(`${sourceName} contains malformed inline Markdown.`);
  }

  return tokens;
}

function headingId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function inlineText(tokens: LegalInline[]): string {
  return tokens.map((token) => token.text).join("");
}

export function parseLegalMarkdown(
  markdown: string,
  sourceName = "Legal document",
): LegalDocument {
  if (markdown.includes("<") || markdown.includes(">")) {
    throw new Error(`${sourceName} contains raw HTML.`);
  }

  const lines = markdown.replace(/\r\n/g, "\n").trim().split("\n");
  const blocks: LegalBlock[] = [];

  for (let index = 0; index < lines.length;) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }

    if (line.startsWith("###") || /^\d+\.\s/.test(line)) {
      throw new Error(`${sourceName} contains unsupported block Markdown.`);
    }

    if (line.startsWith("# ") || line.startsWith("## ")) {
      const level = line.startsWith("## ") ? 2 : 1;
      const text = line.slice(level + 1).trim();
      if (!text) throw new Error(`${sourceName} contains an empty heading.`);
      blocks.push({ id: headingId(text), kind: "heading", level, text });
      index += 1;
      continue;
    }

    if (line.startsWith("- ")) {
      const items: LegalInline[][] = [];
      while (index < lines.length && lines[index].trim().startsWith("- ")) {
        const item = lines[index].trim().slice(2).trim();
        if (!item) throw new Error(`${sourceName} contains an empty list item.`);
        items.push(parseInline(item, sourceName));
        index += 1;
      }
      blocks.push({ items, kind: "list" });
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const paragraphLine = lines[index].trim();
      if (!paragraphLine || paragraphLine.startsWith("# ") || paragraphLine.startsWith("## ") || paragraphLine.startsWith("- ")) break;
      paragraphLines.push(paragraphLine);
      index += 1;
    }
    blocks.push({ content: parseInline(paragraphLines.join(" "), sourceName), kind: "paragraph" });
  }

  const titleBlock = blocks[0];
  const dateBlock = blocks[1];
  if (!titleBlock || titleBlock.kind !== "heading" || titleBlock.level !== 1) {
    throw new Error(`${sourceName} must begin with one level-one title.`);
  }
  if (blocks.some((block, index) => index > 0 && block.kind === "heading" && block.level === 1)) {
    throw new Error(`${sourceName} must contain only one level-one title.`);
  }
  if (!dateBlock || dateBlock.kind !== "paragraph") {
    throw new Error(`${sourceName} must include an effective date after its title.`);
  }

  const effectiveLabel = inlineText(dateBlock.content);
  if (!/^Effective date: .+/.test(effectiveLabel) || dateBlock.content[0]?.kind !== "emphasis") {
    throw new Error(`${sourceName} must include an emphasized effective date after its title.`);
  }

  const sectionBlocks = blocks.filter(
    (block): block is Extract<LegalBlock, { kind: "heading" }> => block.kind === "heading" && block.level === 2,
  );
  if (sectionBlocks.length === 0) throw new Error(`${sourceName} must contain numbered sections.`);

  const seenIds = new Set<string>();
  sectionBlocks.forEach((section, index) => {
    if (!section.text.startsWith(`${index + 1}. `)) {
      throw new Error(`${sourceName} sections must be numbered sequentially.`);
    }
    if (!section.id || seenIds.has(section.id)) {
      throw new Error(`${sourceName} contains duplicate or invalid section headings.`);
    }
    seenIds.add(section.id);
  });

  return {
    blocks: blocks.slice(2),
    effectiveDate: effectiveLabel.replace("Effective date: ", ""),
    sections: sectionBlocks.map(({ id, text }) => ({ id, text })),
    title: titleBlock.text,
  };
}
