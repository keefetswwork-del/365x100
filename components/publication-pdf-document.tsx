import {
  Document as PdfDocument,
  Font,
  Image,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { downloadMediaBlob } from "@/lib/entry-media";
import { displayPublicationDate, type PublicationPageModel, type PublicationSpan } from "@/lib/publication-document";
import type { PublicationDocument } from "@/types/publication";

let fontsRegistered = false;

function registerFonts() {
  if (fontsRegistered || typeof window === "undefined") return;
  const origin = window.location.origin;
  Font.register({
    family: "Noto Sans",
    fonts: [
      { src: `${origin}/fonts/noto-sans-latin.woff`, fontStyle: "normal", fontWeight: 400 },
      { src: `${origin}/fonts/noto-sans-latin-bold.woff`, fontStyle: "normal", fontWeight: 700 },
      { src: `${origin}/fonts/noto-sans-latin-italic.woff`, fontStyle: "italic", fontWeight: 400 },
      { src: `${origin}/fonts/noto-sans-latin-bold-italic.woff`, fontStyle: "italic", fontWeight: 700 },
    ],
  });
  Font.register({
    family: "Noto Sans CJK",
    fonts: [
      { src: `${origin}/fonts/noto-sans-cjk-sc.otf`, fontWeight: 400 },
      { src: `${origin}/fonts/noto-sans-cjk-sc-bold.otf`, fontWeight: 700 },
    ],
  });
  Font.register({
    family: "Noto Sans Tamil",
    fonts: [
      { src: `${origin}/fonts/noto-sans-tamil.woff`, fontWeight: 400 },
      { src: `${origin}/fonts/noto-sans-tamil-bold.woff`, fontWeight: 700 },
    ],
  });
  Font.register({
    family: "Noto Emoji",
    fonts: [
      { src: `${origin}/fonts/noto-emoji.woff`, fontWeight: 400 },
      { src: `${origin}/fonts/noto-emoji.woff`, fontWeight: 700 },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

const styles = StyleSheet.create({
  page: { backgroundColor: "#fffaf3", color: "#18332e", fontFamily: "Noto Sans", fontSize: 10.5, padding: 42 },
  cover: { backgroundColor: "#18332e", color: "#ffffff", justifyContent: "flex-end", padding: 42 },
  coverImage: { height: "100%", left: 0, objectFit: "cover", opacity: 0.48, position: "absolute", top: 0, width: "100%" },
  coverLabel: { fontSize: 8, letterSpacing: 2, marginBottom: 12, textTransform: "uppercase" },
  coverTitle: { fontFamily: "Noto Sans", fontSize: 34, fontWeight: 700, lineHeight: 1.05 },
  coverDate: { fontSize: 9, marginTop: 16, opacity: 0.8 },
  section: { marginBottom: 22 },
  kicker: { color: "#b33f2e", fontSize: 7.5, letterSpacing: 1.5, marginBottom: 8, textTransform: "uppercase" },
  editorialReview: { fontSize: 16, lineHeight: 1.55 },
  heading: { fontSize: 18, fontWeight: 700, lineHeight: 1.2, marginBottom: 8 },
  paragraph: { lineHeight: 1.65, marginBottom: 8 },
  quote: { borderLeftColor: "#91ad9e", borderLeftWidth: 2, fontSize: 13, lineHeight: 1.55, marginBottom: 10, paddingLeft: 10 },
  list: { lineHeight: 1.55, marginBottom: 5, paddingLeft: 12 },
  photo: { marginBottom: 14, marginTop: 8, maxHeight: 360, objectFit: "contain", width: "100%" },
  footer: { bottom: 20, color: "#66736e", fontSize: 7, left: 42, position: "absolute", right: 42, textAlign: "center" },
  theme: { backgroundColor: "#dcebdc", borderRadius: 8, fontSize: 8, marginBottom: 5, marginRight: 5, paddingHorizontal: 8, paddingVertical: 5 },
  themeRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 14 },
});

function fontFor(text: string): string {
  if (/\p{Script=Han}/u.test(text)) return "Noto Sans CJK";
  if (/\p{Script=Tamil}/u.test(text)) return "Noto Sans Tamil";
  if (/\p{Extended_Pictographic}/u.test(text)) return "Noto Emoji";
  return "Noto Sans";
}

function splitByFont(text: string): Array<{ font: string; text: string }> {
  const output: Array<{ font: string; text: string }> = [];
  for (const char of [...text]) {
    const font = fontFor(char);
    const previous = output.at(-1);
    if (previous?.font === font) previous.text += char;
    else output.push({ font, text: char });
  }
  return output;
}

function Runs({ bold = false, italic = false, text }: { bold?: boolean; italic?: boolean; text: string }) {
  return <>{splitByFont(text).map((run, index) => <Text key={index} style={{
    fontFamily: run.font,
    fontStyle: run.font === "Noto Sans" && italic ? "italic" : "normal",
    fontWeight: bold ? 700 : 400,
  }}>{run.text}</Text>)}</>;
}

function Span({ span }: { span: PublicationSpan }) {
  const textDecoration = span.underline ? "underline" as const : span.strike ? "line-through" as const : "none" as const;
  const children = splitByFont(span.text).map((run, index) => <Text key={index} style={{ fontFamily: run.font, fontStyle: run.font === "Noto Sans" && span.italic ? "italic" : "normal", fontWeight: span.bold ? 700 : 400, textDecoration }}>{run.text}</Text>);
  return span.link ? <Link src={span.link}>{children}</Link> : <>{children}</>;
}

function PublicationPdf({ images, model }: { images: Record<string, string>; model: PublicationPageModel }) {
  const cover = model.coverMediaId ? images[model.coverMediaId] : null;
  return <PdfDocument title={model.title} author="365x100" subject="Private monthly journal chapter">
    <Page size="A5" style={styles.cover}>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- React PDF Image is not a DOM image. */}
      {cover && <Image src={cover} style={styles.coverImage} />}
      <View><Text style={styles.coverLabel}>365x100 monthly chapter</Text><Text style={styles.coverTitle}><Runs bold text={model.title} /></Text><Text style={styles.coverDate}>{displayPublicationDate(model.periodStart)} – {displayPublicationDate(model.periodEnd)}</Text></View>
    </Page>
    <Page size="A5" style={styles.page} wrap>
      {model.mode === "ai" && model.editorial && <View style={styles.section}>
        <Text style={styles.kicker}>The month in review</Text>
        <Text style={styles.editorialReview}><Runs text={model.editorial.review} /></Text>
        {model.editorial.themes.length > 0 && <View style={styles.themeRow}>{model.editorial.themes.map((theme) => <Text key={theme} style={styles.theme}><Runs text={theme} /></Text>)}</View>}
        {model.editorial.moments.map((moment) => <View key={`${moment.sourceRef}-${moment.text}`} style={styles.section} wrap={false}><Text style={styles.kicker}>{displayPublicationDate(moment.date)}</Text><Text style={styles.paragraph}><Runs text={moment.text} /></Text></View>)}
        {model.editorial.quotations.map((quote) => <Text key={`${quote.sourceRef}-${quote.quote}`} style={styles.quote}>“<Runs text={quote.quote} />”</Text>)}
      </View>}
      {model.entries.map((entry) => <View key={entry.date} style={styles.section}>
        <View minPresenceAhead={80} wrap={false}>
          <Text style={styles.kicker}>{displayPublicationDate(entry.date)}</Text>
          {entry.title && <Text style={styles.heading}><Runs bold text={entry.title} /></Text>}
        </View>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- React PDF Image is not a DOM image. */}
        {entry.mediaId && images[entry.mediaId] && <Image src={images[entry.mediaId]} style={styles.photo} />}
        <View>{entry.blocks.map((block, index) => <Text key={index} style={{ ...(block.kind === "heading" ? styles.heading : block.kind === "quote" ? styles.quote : block.kind === "list-item" ? styles.list : styles.paragraph), textAlign: block.align }}>
          {block.kind === "list-item" ? `${block.ordered ? `${index + 1}.` : "•"} ` : ""}
          {block.spans.map((span, spanIndex) => <Span key={spanIndex} span={span} />)}
        </Text>)}</View>
      </View>)}
      <Text fixed style={styles.footer} render={({ pageNumber, totalPages }) => `365x100 · ${pageNumber} / ${totalPages}`} />
    </Page>
  </PdfDocument>;
}

async function webpToJpegDataUrl(blob: Blob): Promise<string> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Photo could not be prepared for PDF.");
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.9);
}

export async function downloadPublicationPdf(
  client: SupabaseClient<Database>,
  document: PublicationDocument,
  model: PublicationPageModel,
): Promise<void> {
  registerFonts();
  const images: Record<string, string> = {};
  for (const entry of document.entries) {
    if (!entry.media || images[entry.media.id]) continue;
    images[entry.media.id] = await webpToJpegDataUrl(await downloadMediaBlob(client, entry.media));
  }
  const blob = await pdf(<PublicationPdf images={images} model={model} />).toBlob();
  const link = globalThis.document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = `365x100-chapter-${model.periodStart.slice(0, 7)}.pdf`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
