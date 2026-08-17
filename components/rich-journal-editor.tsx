"use client";

import {
  $isLinkNode,
  $toggleLink,
  LinkNode,
  TOGGLE_LINK_COMMAND,
} from "@lexical/link";
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListItemNode,
  ListNode,
  REMOVE_LIST_COMMAND,
} from "@lexical/list";
import {
  $getSelectionStyleValueForProperty,
  $patchStyleText,
  $setBlocksType,
} from "@lexical/selection";
import {
  $createHeadingNode,
  $createQuoteNode,
  HeadingNode,
  QuoteNode,
} from "@lexical/rich-text";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { TabIndentationPlugin } from "@lexical/react/LexicalTabIndentationPlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import type { EmojiClickData, EmojiStyle } from "emoji-picker-react";
import dynamic from "next/dynamic";
import {
  $createLineBreakNode,
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
  FORMAT_ELEMENT_COMMAND,
  INDENT_CONTENT_COMMAND,
  OUTDENT_CONTENT_COMMAND,
  REDO_COMMAND,
  SELECTION_CHANGE_COMMAND,
  UNDO_COMMAND,
  type ElementFormatType,
  type LexicalEditor,
  type LexicalNode,
  type RangeSelection,
  type TextFormatType,
} from "lexical";
import { useEffect, useRef, useState } from "react";
import { mergeRegister } from "@lexical/utils";

import {
  isSafeLink,
  sanitizeRichEntryDocument,
  type RichEntryDocument,
} from "@/lib/rich-text";

const EmojiPicker = dynamic(() => import("emoji-picker-react"), {
  loading: () => <p className="p-4 text-sm text-[var(--muted)]">Loading emoji…</p>,
  ssr: false,
});

type BlockType = "paragraph" | "title" | "subtitle" | "quote" | "bullet" | "number";

interface RichJournalEditorProps {
  describedBy: string;
  disabled: boolean;
  label: string;
  onChange: (content: string, richContent: RichEntryDocument) => void;
  placeholder: string;
  plainContent: string;
  richContent: RichEntryDocument | null;
}

interface ToolbarState {
  alignment: "left" | "center" | "right" | "justify";
  blockType: BlockType;
  bold: boolean;
  fontFamily: string;
  fontSize: string;
  highlight: string;
  italic: boolean;
  link: boolean;
  selectionExpanded: boolean;
  strike: boolean;
  textColor: string;
  underline: boolean;
}

const INITIAL_TOOLBAR: ToolbarState = {
  alignment: "left",
  blockType: "paragraph",
  bold: false,
  fontFamily: "",
  fontSize: "",
  highlight: "",
  italic: false,
  link: false,
  selectionExpanded: false,
  strike: false,
  textColor: "",
  underline: false,
};

const TEXT_COLORS = [
  ["Ink", "#18332e"],
  ["Terracotta", "#7d3025"],
  ["Forest", "#24513f"],
  ["Blue", "#304f73"],
] as const;

const HIGHLIGHTS = [
  ["Peach", "#fde1d8"],
  ["Sun", "#f8edb8"],
  ["Sage", "#dcebdc"],
  ["Sky", "#dce9f5"],
] as const;

function initialEditorState(
  richContent: RichEntryDocument | null,
  plainContent: string,
) {
  const sanitized = sanitizeRichEntryDocument(richContent);
  if (sanitized) return JSON.stringify(sanitized.editorState);

  return () => {
    const paragraph = $createParagraphNode();
    const lines = plainContent.split("\n");
    lines.forEach((line, index) => {
      if (index > 0) paragraph.append($createLineBreakNode());
      if (line) paragraph.append($createTextNode(line));
    });
    $getRoot().append(paragraph);
  };
}

function ToolbarButton({
  active,
  disabled = false,
  label,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`grid h-9 min-w-9 place-items-center rounded-lg px-2 text-sm font-bold outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-30 ${active ? "bg-[var(--ink)] text-white" : "text-[var(--ink)] hover:bg-white/75"}`}
    >
      {children}
    </button>
  );
}

function selectionBlockType(selection: RangeSelection): BlockType {
  const top = selection.anchor.getNode().getTopLevelElementOrThrow();
  if (top.getType() === "heading") {
    return (top as HeadingNode).getTag() === "h2" ? "title" : "subtitle";
  }
  if (top.getType() === "quote") return "quote";
  if (top.getType() === "list") {
    return (top as ListNode).getListType() === "number" ? "number" : "bullet";
  }
  const parent = top.getParent();
  if (parent?.getType() === "list") {
    return (parent as ListNode).getListType() === "number" ? "number" : "bullet";
  }
  return "paragraph";
}

function selectionAlignment(
  selection: RangeSelection,
): ToolbarState["alignment"] {
  const node = selection.anchor.getNode();
  let element = $isElementNode(node) ? node : node.getParent();

  while (element?.isInline()) {
    element = element.getParent();
  }

  const format = element?.getFormatType();
  return format === "center" ||
    format === "right" ||
    format === "justify"
    ? format
    : "left";
}

function selectionHasLink(selection: RangeSelection): boolean {
  let node: LexicalNode | null = selection.anchor.getNode();
  while (node) {
    if ($isLinkNode(node)) return true;
    node = node.getParent();
  }
  return false;
}

function toolbarStateFromSelection(selection: RangeSelection): ToolbarState {
  return {
    alignment: selectionAlignment(selection),
    blockType: selectionBlockType(selection),
    bold: selection.hasFormat("bold"),
    fontFamily: $getSelectionStyleValueForProperty(
      selection,
      "font-family",
      "",
    ),
    fontSize: $getSelectionStyleValueForProperty(selection, "font-size", ""),
    highlight: $getSelectionStyleValueForProperty(
      selection,
      "background-color",
      "",
    ),
    italic: selection.hasFormat("italic"),
    link: selectionHasLink(selection),
    selectionExpanded: !selection.isCollapsed(),
    strike: selection.hasFormat("strikethrough"),
    textColor: $getSelectionStyleValueForProperty(selection, "color", ""),
    underline: selection.hasFormat("underline"),
  };
}

function Toolbar({ disabled }: { disabled: boolean }) {
  const [editor] = useLexicalComposerContext();
  const [state, setState] = useState(INITIAL_TOOLBAR);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [linkError, setLinkError] = useState("");
  const [status, setStatus] = useState(
    "Select text to format existing words, or place the cursor to format what you type next.",
  );
  const savedSelection = useRef<RangeSelection | null>(null);

  useEffect(() => editor.setEditable(!disabled), [disabled, editor]);

  useEffect(() => mergeRegister(
    editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;
        savedSelection.current = selection.clone();
        setState(toolbarStateFromSelection(selection));
      });
    }),
    editor.registerCommand(SELECTION_CHANGE_COMMAND, () => {
      editor.getEditorState().read(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          savedSelection.current = selection.clone();
          setState(toolbarStateFromSelection(selection));
        }
      });
      return false;
    }, COMMAND_PRIORITY_CRITICAL),
    editor.registerCommand(CAN_UNDO_COMMAND, (value) => { setCanUndo(value); return false; }, COMMAND_PRIORITY_CRITICAL),
    editor.registerCommand(CAN_REDO_COMMAND, (value) => { setCanRedo(value); return false; }, COMMAND_PRIORITY_CRITICAL),
  ), [editor]);

  function applyToSelection(
    label: string,
    action: (selection: RangeSelection) => void,
    mode: "block" | "inline" | "insert" = "inline",
  ): boolean {
    let expanded: boolean | null = null;

    editor.update(() => {
      let selection = $getSelection();
      if (!$isRangeSelection(selection) && savedSelection.current) {
        selection = savedSelection.current.clone();
        $setSelection(selection);
      }
      if (!$isRangeSelection(selection)) return;

      expanded = !selection.isCollapsed();
      action(selection);

      const nextSelection = $getSelection();
      if ($isRangeSelection(nextSelection)) {
        savedSelection.current = nextSelection.clone();
      }
    });

    if (expanded === null) {
      setStatus("Place the cursor in your entry before choosing formatting.");
      return false;
    }

    if (mode === "block") {
      setStatus(`${label} applied to the current block.`);
    } else if (mode === "insert") {
      setStatus(`${label} inserted.`);
    } else {
      setStatus(
        expanded
          ? `${label} applied to selected text.`
          : `${label} is ready for what you type next.`,
      );
    }

    setMoreOpen(false);
    editor.focus();
    return true;
  }

  function runHistory(command: typeof UNDO_COMMAND | typeof REDO_COMMAND, label: string) {
    editor.dispatchCommand(command, undefined);
    setStatus(label);
    editor.focus();
  }

  function toggleTextFormat(format: TextFormatType, label: string) {
    applyToSelection(label, (selection) => selection.formatText(format));
  }

  function setBlock(type: BlockType) {
    const labels: Record<BlockType, string> = {
      bullet: "Bulleted list",
      number: "Numbered list",
      paragraph: "Paragraph",
      quote: "Quote",
      subtitle: "Subtitle",
      title: "Title",
    };

    applyToSelection(labels[type], () => {
      if (type === "bullet") {
        editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
        return;
      }
      if (type === "number") {
        editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
        return;
      }

      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
      const selection = $getSelection();
      if (type === "title") $setBlocksType(selection, () => $createHeadingNode("h2"));
      else if (type === "subtitle") $setBlocksType(selection, () => $createHeadingNode("h3"));
      else if (type === "quote") $setBlocksType(selection, () => $createQuoteNode());
      else $setBlocksType(selection, () => $createParagraphNode());
    }, "block");
  }

  function patchStyle(property: string, value: string | null, label: string) {
    applyToSelection(label, (selection) => {
      $patchStyleText(selection, { [property]: value });
    });
  }

  function formatElement(alignment: ElementFormatType) {
    applyToSelection(`${alignment.slice(0, 1).toUpperCase()}${alignment.slice(1)} alignment`, () => {
      editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, alignment);
    }, "block");
  }

  function changeIndent(command: typeof INDENT_CONTENT_COMMAND | typeof OUTDENT_CONTENT_COMMAND, label: string) {
    applyToSelection(label, () => {
      editor.dispatchCommand(command, undefined);
    }, "block");
  }

  function clearFormatting() {
    applyToSelection("Formatting cleared", () => {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
      let selection = $getSelection();
      if (!$isRangeSelection(selection)) return;

      $toggleLink(null);
      selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      selection.setFormat(0);
      selection.setStyle("");
      selection.getNodes().forEach((node) => {
        if ($isTextNode(node)) {
          node.setFormat(0);
          node.setStyle("");
        }
      });
      $setBlocksType(
        selection,
        () => $createParagraphNode(),
        (_previous, paragraph) => {
          paragraph.setFormat("");
          paragraph.setIndent(0);
        },
      );
    }, "block");
  }

  function insertEmoji(data: EmojiClickData) {
    if (applyToSelection("Emoji", (selection) => selection.insertText(data.emoji), "insert")) {
      setEmojiOpen(false);
    }
  }

  function openLink() {
    if (!savedSelection.current || (savedSelection.current.isCollapsed() && !state.link)) {
      setStatus("Select text to add a link.");
      setLinkError("Select text to add a link.");
      setMoreOpen(false);
      editor.focus();
      return;
    }

    setLinkError("");
    setMoreOpen(false);
    setLinkOpen(true);
  }

  function addLink() {
    const trimmedValue = linkValue.trim();
    const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(trimmedValue);
    const candidate = hasScheme ? trimmedValue : `https://${trimmedValue}`;
    if (!isSafeLink(candidate)) {
      setLinkError("Enter a valid web address.");
      return;
    }
    const applied = applyToSelection("Link", (selection) => {
      if (selection.isCollapsed() && !state.link) return;
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, {
        rel: "noopener noreferrer",
        target: "_blank",
        url: candidate,
      });
    });
    if (applied) {
      setLinkError("");
      setLinkValue("");
      setLinkOpen(false);
    }
  }

  function removeLink() {
    const applied = applyToSelection("Link removed", () => {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
    });
    if (applied) {
      setLinkError("");
      setLinkValue("");
      setLinkOpen(false);
    }
  }

  function closeMore() {
    setMoreOpen(false);
    editor.focus();
  }

  const advancedControls = (
    <>
      <label className="toolbar-select-label">
        <span className="sr-only">Text style</span>
        <select value={state.blockType} onChange={(event) => setBlock(event.target.value as BlockType)} className="toolbar-select" disabled={disabled} aria-label="Text style">
          <option value="paragraph">Paragraph</option><option value="title">Title</option><option value="subtitle">Subtitle</option><option value="quote">Quote</option><option value="bullet">Bullets</option><option value="number">Numbered list</option>
        </select>
      </label>
      <label className="toolbar-select-label"><span className="sr-only">Font</span><select className="toolbar-select" value={state.fontFamily} onChange={(event) => patchStyle("font-family", event.target.value || null, event.target.selectedOptions[0]?.text ?? "Font")} disabled={disabled} aria-label="Font"><option value="">Font</option><option value="var(--font-newsreader)">Newsreader</option><option value="var(--font-manrope)">Manrope</option></select></label>
      <label className="toolbar-select-label"><span className="sr-only">Font size</span><select className="toolbar-select" value={state.fontSize} onChange={(event) => patchStyle("font-size", event.target.value || null, `${event.target.selectedOptions[0]?.text ?? "Font size"} text`)} disabled={disabled} aria-label="Font size"><option value="">Size</option><option value="0.85em">Small</option><option value="1em">Regular</option><option value="1.2em">Large</option></select></label>
      <ToolbarButton disabled={disabled} label="Bulleted list" active={state.blockType === "bullet"} onClick={() => setBlock("bullet")}>• List</ToolbarButton>
      <ToolbarButton disabled={disabled} label="Numbered list" active={state.blockType === "number"} onClick={() => setBlock("number")}>1. List</ToolbarButton>
      <ToolbarButton disabled={disabled} label="Decrease indent" onClick={() => changeIndent(OUTDENT_CONTENT_COMMAND, "Indent decreased")}>− Indent</ToolbarButton>
      <ToolbarButton disabled={disabled} label="Increase indent" onClick={() => changeIndent(INDENT_CONTENT_COMMAND, "Indent increased")}>+ Indent</ToolbarButton>
      {(["left", "center", "right", "justify"] as const).map((alignment) => <ToolbarButton disabled={disabled} key={alignment} label={`Align ${alignment}`} active={state.alignment === alignment} onClick={() => formatElement(alignment)}>{alignment.slice(0, 1).toUpperCase()}</ToolbarButton>)}
      <div className="toolbar-palette" aria-label="Text colour"><span>Text</span>{TEXT_COLORS.map(([label, color]) => <button key={color} type="button" aria-label={`${label} text`} aria-pressed={state.textColor === color} disabled={disabled} title={`${label} text`} onMouseDown={(event) => event.preventDefault()} onClick={() => patchStyle("color", color, `${label} text`)} className={`toolbar-swatch ${state.textColor === color ? "toolbar-swatch-active" : ""}`} style={{ backgroundColor: color }} />)}</div>
      <div className="toolbar-palette" aria-label="Highlight colour"><span>Mark</span>{HIGHLIGHTS.map(([label, color]) => <button key={color} type="button" aria-label={`${label} highlight`} aria-pressed={state.highlight === color} disabled={disabled} title={`${label} highlight`} onMouseDown={(event) => event.preventDefault()} onClick={() => patchStyle("background-color", color, `${label} highlight`)} className={`toolbar-swatch border border-[var(--line)] ${state.highlight === color ? "toolbar-swatch-active" : ""}`} style={{ backgroundColor: color }} />)}</div>
      <ToolbarButton disabled={disabled} label="Add link" active={state.link} onClick={openLink}>Link</ToolbarButton>
      <ToolbarButton disabled={disabled} label="Clear formatting" onClick={clearFormatting}>Clear</ToolbarButton>
    </>
  );

  return (
    <div className="relative border-b border-[var(--line)] pb-3" aria-label="Text formatting toolbar" role="toolbar">
      <fieldset disabled={disabled} className="flex flex-wrap items-center gap-1 border-0 p-0">
        <ToolbarButton label="Undo" disabled={!canUndo || disabled} onClick={() => runHistory(UNDO_COMMAND, "Last edit undone.")}>Undo</ToolbarButton>
        <ToolbarButton label="Redo" disabled={!canRedo || disabled} onClick={() => runHistory(REDO_COMMAND, "Last edit restored.")}>Redo</ToolbarButton>
        <span className="mx-1 h-6 w-px bg-[var(--line)]" aria-hidden="true" />
        <ToolbarButton label="Bold" active={state.bold} onClick={() => toggleTextFormat("bold", "Bold")}><span className="font-black">B</span></ToolbarButton>
        <ToolbarButton label="Italic" active={state.italic} onClick={() => toggleTextFormat("italic", "Italic")}><span className="italic">I</span></ToolbarButton>
        <ToolbarButton label="Underline" active={state.underline} onClick={() => toggleTextFormat("underline", "Underline")}><span className="underline">U</span></ToolbarButton>
        <ToolbarButton label="Strikethrough" active={state.strike} onClick={() => toggleTextFormat("strikethrough", "Strikethrough")}><span className="line-through">S</span></ToolbarButton>
        <div className="relative">
          <ToolbarButton label="Insert emoji" active={emojiOpen} onClick={() => setEmojiOpen((value) => !value)}>Emoji</ToolbarButton>
          {emojiOpen && <div className="absolute left-0 top-11 z-30 overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-2xl"><EmojiPicker emojiStyle={"native" as EmojiStyle} onEmojiClick={insertEmoji} lazyLoadEmojis searchPlaceHolder="Search emoji" width={320} height={400} /></div>}
        </div>
        <div className="hidden flex-wrap items-center gap-1 md:flex">{advancedControls}</div>
        <button type="button" onClick={() => setMoreOpen(true)} className="ml-auto rounded-lg border border-[var(--line)] px-3 py-2 text-xs font-bold outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] md:hidden">More</button>
      </fieldset>

      <p className="mt-2 text-xs leading-5 text-[var(--muted)]" aria-live="polite" role="status">{status}</p>

      {moreOpen && <div className="fixed inset-0 z-[70] flex items-end bg-[rgba(19,35,31,0.45)]" onMouseDown={closeMore}><section aria-label="More formatting options" aria-modal="true" role="dialog" className="max-h-[78vh] w-full overflow-y-auto rounded-t-[2rem] bg-[var(--paper)] p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><div className="mb-4 flex items-center justify-between"><h2 className="font-serif text-2xl">Shape the page</h2><button type="button" onClick={closeMore} className="rounded-full border border-[var(--line)] px-3 py-1.5 text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">Close</button></div><div className="flex flex-wrap gap-2">{advancedControls}</div></section></div>}

      {linkOpen && <div aria-label="Link settings" aria-modal="true" role="dialog" className="absolute left-0 top-12 z-40 w-full max-w-sm rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-4 shadow-2xl"><label className="text-sm font-bold" htmlFor="journal-link">Web address</label><input id="journal-link" type="url" value={linkValue} onChange={(event) => setLinkValue(event.target.value)} placeholder="https://example.com" className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]" />{linkError && <p className="mt-2 text-sm text-[var(--accent-dark)]" role="alert">{linkError}</p>}<div className="mt-3 flex gap-2"><button type="button" onClick={addLink} className="rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-bold text-white">Add link</button><button type="button" onClick={removeLink} className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-bold">Remove link</button><button type="button" onClick={() => { setLinkOpen(false); setLinkError(""); editor.focus(); }} className="rounded-full px-3 py-2 text-sm font-bold">Cancel</button></div></div>}
    </div>
  );
}

function EditorChangePlugin({ onChange }: Pick<RichJournalEditorProps, "onChange">) {
  return <OnChangePlugin ignoreSelectionChange onChange={(editorState, editor, tags) => {
    let content = "";
    editorState.read(() => { content = $getRoot().getTextContent(); });
    const serialized = editorState.toJSON();
    const richContent = sanitizeRichEntryDocument({
      schemaVersion: 1,
      editorState: serialized,
    });
    if (!richContent) return;
    if (
      !tags.has("sanitize-rich-entry") &&
      JSON.stringify(serialized) !== JSON.stringify(richContent.editorState)
    ) {
      editor.setEditorState(
        editor.parseEditorState(JSON.stringify(richContent.editorState)),
        { tag: "sanitize-rich-entry" },
      );
    }
    onChange(content, richContent);
  }} />;
}

export function RichJournalEditor({
  describedBy,
  disabled,
  label,
  onChange,
  placeholder,
  plainContent,
  richContent,
}: RichJournalEditorProps) {
  const initialConfig = {
    namespace: "365x100-journal",
    editable: !disabled,
    editorState: initialEditorState(richContent, plainContent),
    nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode],
    onError(error: Error, editor: LexicalEditor) {
      editor.setEditable(false);
      throw error;
    },
    theme: {
      heading: { h2: "rich-editor-title", h3: "rich-editor-subtitle" },
      link: "rich-editor-link",
      list: { listitem: "rich-editor-list-item", nested: { listitem: "rich-editor-nested-list" }, ol: "rich-editor-ol", ul: "rich-editor-ul" },
      paragraph: "rich-editor-paragraph",
      quote: "rich-editor-quote",
      text: { bold: "font-bold", italic: "italic", strikethrough: "line-through", underline: "underline" },
    },
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <Toolbar disabled={disabled} />
      <div className="relative min-h-[21rem] flex-1 sm:min-h-[25rem]">
        <RichTextPlugin
          contentEditable={<ContentEditable aria-describedby={describedBy} aria-label={label} className="rich-editor-content block min-h-[21rem] w-full px-2 py-5 font-serif text-[1.45rem] leading-8 text-[var(--ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-4 focus-visible:ring-offset-white/70 sm:min-h-[25rem] sm:px-3 sm:text-[1.65rem]" spellCheck />}
          placeholder={<p className="pointer-events-none absolute left-2 top-5 font-serif text-[1.45rem] leading-8 text-[var(--muted)]/45 sm:left-3 sm:text-[1.65rem]">{placeholder}</p>}
          ErrorBoundary={LexicalErrorBoundary}
        />
      </div>
      <HistoryPlugin />
      <ListPlugin />
      <LinkPlugin />
      <TabIndentationPlugin />
      <EditorChangePlugin onChange={onChange} />
    </LexicalComposer>
  );
}
