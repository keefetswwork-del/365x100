"use client";

import { LinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListItemNode,
  ListNode,
  REMOVE_LIST_COMMAND,
} from "@lexical/list";
import { $patchStyleText, $setBlocksType } from "@lexical/selection";
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
  $isRangeSelection,
  $isTextNode,
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
  FORMAT_ELEMENT_COMMAND,
  FORMAT_TEXT_COMMAND,
  INDENT_CONTENT_COMMAND,
  OUTDENT_CONTENT_COMMAND,
  REDO_COMMAND,
  SELECTION_CHANGE_COMMAND,
  UNDO_COMMAND,
  type ElementFormatType,
  type LexicalEditor,
} from "lexical";
import { useEffect, useState } from "react";
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
  blockType: BlockType;
  bold: boolean;
  italic: boolean;
  strike: boolean;
  underline: boolean;
}

const INITIAL_TOOLBAR: ToolbarState = {
  blockType: "paragraph",
  bold: false,
  italic: false,
  strike: false,
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
  active = false,
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
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`grid h-9 min-w-9 place-items-center rounded-lg px-2 text-sm font-bold outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-30 ${active ? "bg-[var(--ink)] text-white" : "text-[var(--ink)] hover:bg-white/75"}`}
    >
      {children}
    </button>
  );
}

function selectionBlockType(): BlockType {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return "paragraph";
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

  useEffect(() => editor.setEditable(!disabled), [disabled, editor]);

  useEffect(() => mergeRegister(
    editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;
        setState({
          blockType: selectionBlockType(),
          bold: selection.hasFormat("bold"),
          italic: selection.hasFormat("italic"),
          strike: selection.hasFormat("strikethrough"),
          underline: selection.hasFormat("underline"),
        });
      });
    }),
    editor.registerCommand(SELECTION_CHANGE_COMMAND, () => {
      editor.getEditorState().read(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          setState({
            blockType: selectionBlockType(),
            bold: selection.hasFormat("bold"),
            italic: selection.hasFormat("italic"),
            strike: selection.hasFormat("strikethrough"),
            underline: selection.hasFormat("underline"),
          });
        }
      });
      return false;
    }, COMMAND_PRIORITY_CRITICAL),
    editor.registerCommand(CAN_UNDO_COMMAND, (value) => { setCanUndo(value); return false; }, COMMAND_PRIORITY_CRITICAL),
    editor.registerCommand(CAN_REDO_COMMAND, (value) => { setCanRedo(value); return false; }, COMMAND_PRIORITY_CRITICAL),
  ), [editor]);

  function setBlock(type: BlockType) {
    if (type === "bullet") {
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
      return;
    }
    if (type === "number") {
      editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
      return;
    }
    editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
    editor.update(() => {
      const selection = $getSelection();
      if (type === "title") $setBlocksType(selection, () => $createHeadingNode("h2"));
      else if (type === "subtitle") $setBlocksType(selection, () => $createHeadingNode("h3"));
      else if (type === "quote") $setBlocksType(selection, () => $createQuoteNode());
      else $setBlocksType(selection, () => $createParagraphNode());
    });
  }

  function patchStyle(property: string, value: string | null) {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) $patchStyleText(selection, { [property]: value });
    });
  }

  function clearFormatting() {
    editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      selection.getNodes().forEach((node) => {
        if ($isTextNode(node)) {
          node.setFormat(0);
          node.setStyle("");
        }
      });
      $setBlocksType(selection, () => $createParagraphNode());
    });
  }

  function insertEmoji(data: EmojiClickData) {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) selection.insertText(data.emoji);
    });
    setEmojiOpen(false);
    editor.focus();
  }

  function addLink() {
    const candidate = /^https?:\/\//i.test(linkValue) ? linkValue : `https://${linkValue}`;
    if (!isSafeLink(candidate)) {
      setLinkError("Enter a valid web address.");
      return;
    }
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, { rel: "noopener noreferrer", target: "_blank", url: candidate });
    setLinkError("");
    setLinkValue("");
    setLinkOpen(false);
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
      <label className="toolbar-select-label"><span className="sr-only">Font</span><select className="toolbar-select" defaultValue="" onChange={(event) => patchStyle("font-family", event.target.value || null)} disabled={disabled} aria-label="Font"><option value="">Font</option><option value="var(--font-newsreader)">Newsreader</option><option value="var(--font-manrope)">Manrope</option></select></label>
      <label className="toolbar-select-label"><span className="sr-only">Font size</span><select className="toolbar-select" defaultValue="" onChange={(event) => patchStyle("font-size", event.target.value || null)} disabled={disabled} aria-label="Font size"><option value="">Size</option><option value="0.85em">Small</option><option value="1em">Regular</option><option value="1.2em">Large</option></select></label>
      <ToolbarButton label="Bulleted list" active={state.blockType === "bullet"} onClick={() => setBlock("bullet")}>• List</ToolbarButton>
      <ToolbarButton label="Numbered list" active={state.blockType === "number"} onClick={() => setBlock("number")}>1. List</ToolbarButton>
      <ToolbarButton label="Decrease indent" onClick={() => editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined)}>− Indent</ToolbarButton>
      <ToolbarButton label="Increase indent" onClick={() => editor.dispatchCommand(INDENT_CONTENT_COMMAND, undefined)}>+ Indent</ToolbarButton>
      {(["left", "center", "right", "justify"] as ElementFormatType[]).map((alignment) => <ToolbarButton key={alignment} label={`Align ${alignment}`} onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, alignment)}>{alignment.slice(0, 1).toUpperCase()}</ToolbarButton>)}
      <div className="toolbar-palette" aria-label="Text colour"><span>Text</span>{TEXT_COLORS.map(([label, color]) => <button key={color} type="button" aria-label={`${label} text`} title={`${label} text`} onClick={() => patchStyle("color", color)} className="toolbar-swatch" style={{ backgroundColor: color }} />)}</div>
      <div className="toolbar-palette" aria-label="Highlight colour"><span>Mark</span>{HIGHLIGHTS.map(([label, color]) => <button key={color} type="button" aria-label={`${label} highlight`} title={`${label} highlight`} onClick={() => patchStyle("background-color", color)} className="toolbar-swatch border border-[var(--line)]" style={{ backgroundColor: color }} />)}</div>
      <ToolbarButton label="Add link" onClick={() => setLinkOpen(true)}>Link</ToolbarButton>
      <ToolbarButton label="Clear formatting" onClick={clearFormatting}>Clear</ToolbarButton>
    </>
  );

  return (
    <div className="relative border-b border-[var(--line)] pb-3" aria-label="Text formatting toolbar" role="toolbar">
      <fieldset disabled={disabled} className="flex flex-wrap items-center gap-1 border-0 p-0">
        <ToolbarButton label="Undo" disabled={!canUndo || disabled} onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}>Undo</ToolbarButton>
        <ToolbarButton label="Redo" disabled={!canRedo || disabled} onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}>Redo</ToolbarButton>
        <span className="mx-1 h-6 w-px bg-[var(--line)]" aria-hidden="true" />
        <ToolbarButton label="Bold" active={state.bold} onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")}><span className="font-black">B</span></ToolbarButton>
        <ToolbarButton label="Italic" active={state.italic} onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")}><span className="italic">I</span></ToolbarButton>
        <ToolbarButton label="Underline" active={state.underline} onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline")}><span className="underline">U</span></ToolbarButton>
        <ToolbarButton label="Strikethrough" active={state.strike} onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "strikethrough")}><span className="line-through">S</span></ToolbarButton>
        <div className="relative">
          <ToolbarButton label="Insert emoji" active={emojiOpen} onClick={() => setEmojiOpen((value) => !value)}>Emoji</ToolbarButton>
          {emojiOpen && <div className="absolute left-0 top-11 z-30 overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-2xl"><EmojiPicker emojiStyle={"native" as EmojiStyle} onEmojiClick={insertEmoji} lazyLoadEmojis searchPlaceHolder="Search emoji" width={320} height={400} /></div>}
        </div>
        <div className="hidden flex-wrap items-center gap-1 md:flex">{advancedControls}</div>
        <button type="button" onClick={() => setMoreOpen(true)} className="ml-auto rounded-lg border border-[var(--line)] px-3 py-2 text-xs font-bold outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] md:hidden">More</button>
      </fieldset>

      {moreOpen && <div className="fixed inset-0 z-[70] flex items-end bg-[rgba(19,35,31,0.45)]" onMouseDown={() => setMoreOpen(false)}><section aria-label="More formatting options" aria-modal="true" role="dialog" className="max-h-[78vh] w-full overflow-y-auto rounded-t-[2rem] bg-[var(--paper)] p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><div className="mb-4 flex items-center justify-between"><h2 className="font-serif text-2xl">Shape the page</h2><button type="button" onClick={() => setMoreOpen(false)} className="rounded-full border border-[var(--line)] px-3 py-1.5 text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">Close</button></div><div className="flex flex-wrap gap-2">{advancedControls}</div></section></div>}

      {linkOpen && <div className="absolute left-0 top-12 z-40 w-full max-w-sm rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-4 shadow-2xl"><label className="text-sm font-bold" htmlFor="journal-link">Web address</label><input id="journal-link" type="url" value={linkValue} onChange={(event) => setLinkValue(event.target.value)} placeholder="https://example.com" className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]" />{linkError && <p className="mt-2 text-sm text-[var(--accent-dark)]" role="alert">{linkError}</p>}<div className="mt-3 flex gap-2"><button type="button" onClick={addLink} className="rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-bold text-white">Add link</button><button type="button" onClick={() => { editor.dispatchCommand(TOGGLE_LINK_COMMAND, null); setLinkOpen(false); }} className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-bold">Remove link</button><button type="button" onClick={() => setLinkOpen(false)} className="rounded-full px-3 py-2 text-sm font-bold">Cancel</button></div></div>}
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
