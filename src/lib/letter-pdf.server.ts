// Server-only: render a letter as a clean, one-column business
// letter PDF using pdf-lib. Handles multi-page wrapping and optional
// hand-drawn signature (data URL PNG).
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

type LetterInput = {
  subject: string | null;
  body_md: string | null;
  recommender_name: string | null;
  recommender_title: string | null;
  recommender_org: string | null;
  status: string | null;
  signed_at: string | null;
  signed_name: string | null;
  signature_data_url: string | null;
};

type ProjectInput = {
  name: string | null;
  visa_type: string | null;
};

const PAGE = { w: 612, h: 792 }; // US Letter, points
const MARGIN = { x: 72, top: 72, bottom: 72 };
const CONTENT_W = PAGE.w - MARGIN.x * 2;

export async function renderLetterPdf(
  letter: LetterInput,
  project: ProjectInput,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const serifItalic = await doc.embedFont(StandardFonts.TimesRomanItalic);

  const bodyText = (letter.body_md ?? "").trim() || "(The petitioner hasn't finished drafting this letter yet.)";
  const paragraphs = bodyText.split(/\n{2,}/).map((p) => p.replace(/\s+\n/g, "\n").trim()).filter(Boolean);

  let page = doc.addPage([PAGE.w, PAGE.h]);
  let cursorY = PAGE.h - MARGIN.top;

  const addPage = () => {
    page = doc.addPage([PAGE.w, PAGE.h]);
    cursorY = PAGE.h - MARGIN.top;
  };

  const ensureSpace = (h: number) => {
    if (cursorY - h < MARGIN.bottom) addPage();
  };

  const drawText = (
    text: string,
    opts: { font: any; size: number; color?: any; leading?: number } = { font: serif, size: 11 },
  ) => {
    const font = opts.font;
    const size = opts.size;
    const leading = opts.leading ?? size * 1.35;
    const words = text.split(/\s+/).filter(Boolean);
    let line = "";
    const lines: string[] = [];
    for (const w of words) {
      const trial = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(trial, size) > CONTENT_W) {
        if (line) lines.push(line);
        line = w;
      } else {
        line = trial;
      }
    }
    if (line) lines.push(line);
    for (const l of lines) {
      ensureSpace(leading);
      page.drawText(sanitize(l), {
        x: MARGIN.x,
        y: cursorY - size,
        font,
        size,
        color: opts.color ?? rgb(0.05, 0.05, 0.08),
      });
      cursorY -= leading;
    }
  };

  const gap = (h: number) => {
    ensureSpace(h);
    cursorY -= h;
  };

  const drawRule = () => {
    ensureSpace(12);
    page.drawLine({
      start: { x: MARGIN.x, y: cursorY - 4 },
      end: { x: MARGIN.x + CONTENT_W, y: cursorY - 4 },
      thickness: 0.5,
      color: rgb(0.75, 0.75, 0.78),
    });
    cursorY -= 12;
  };

  // ---- Letterhead: recommender identity
  if (letter.recommender_name) {
    drawText(letter.recommender_name, { font: serifBold, size: 14 });
  }
  const subline = [letter.recommender_title, letter.recommender_org]
    .filter(Boolean)
    .join(" · ");
  if (subline) {
    drawText(subline, { font: serifItalic, size: 10.5, color: rgb(0.35, 0.35, 0.4) });
  }
  drawRule();

  // ---- Date (of send / signing)
  const dateLine = letter.signed_at
    ? formatDate(letter.signed_at)
    : formatDate(new Date().toISOString());
  drawText(dateLine, { font: serif, size: 10.5, color: rgb(0.3, 0.3, 0.35) });
  gap(10);

  // ---- Subject
  if (letter.subject && letter.subject.trim()) {
    drawText(`Re: ${letter.subject.trim()}`, { font: serifBold, size: 12 });
    gap(10);
  }

  // ---- Salutation
  drawText("To Whom It May Concern:", { font: serif, size: 11 });
  gap(10);

  // ---- Body paragraphs
  for (const p of paragraphs) {
    drawText(p, { font: serif, size: 11, leading: 15.5 });
    gap(8);
  }

  // ---- Signature block
  gap(24);
  if (letter.status === "signed" && letter.signature_data_url && letter.signature_data_url.startsWith("data:image/png;")) {
    try {
      const b64 = letter.signature_data_url.split(",")[1] ?? "";
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const png = await doc.embedPng(bytes);
      const targetW = 180;
      const scale = targetW / png.width;
      const targetH = png.height * scale;
      ensureSpace(targetH + 6);
      page.drawImage(png, {
        x: MARGIN.x,
        y: cursorY - targetH,
        width: targetW,
        height: targetH,
      });
      cursorY -= targetH + 4;
    } catch {
      // ignore malformed signature
    }
  }

  drawText("Sincerely,", { font: serif, size: 11 });
  gap(6);
  const finalName = letter.signed_name || letter.recommender_name || "";
  if (finalName) {
    drawText(finalName, { font: serifBold, size: 11 });
  }
  const finalSub = [letter.recommender_title, letter.recommender_org].filter(Boolean).join(" · ");
  if (finalSub) {
    drawText(finalSub, { font: serifItalic, size: 10.5, color: rgb(0.35, 0.35, 0.4) });
  }

  if (letter.status === "signed" && letter.signed_at) {
    gap(10);
    drawText(
      `Electronically signed via visaworker.ai · ${formatDate(letter.signed_at)} UTC`,
      { font: serifItalic, size: 9, color: rgb(0.45, 0.45, 0.5) },
    );
  } else {
    gap(10);
    drawText(
      "Draft for review — this letter has not yet been signed.",
      { font: serifItalic, size: 9, color: rgb(0.55, 0.35, 0.35) },
    );
  }

  // ---- Footer on last page: project reference (small, subtle)
  const footer = [project.visa_type, project.name].filter(Boolean).join(" · ");
  if (footer) {
    page.drawText(sanitize(footer), {
      x: MARGIN.x,
      y: 36,
      font: serifItalic,
      size: 8.5,
      color: rgb(0.55, 0.55, 0.6),
    });
  }

  return await doc.save();
}

// pdf-lib WinAnsi only — strip characters outside the encoding to avoid throws.
// Replace common typographic quotes/dashes with ASCII equivalents.
function sanitize(s: string): string {
  return s
    .replace(/[\u2018\u2019\u201A\u2039\u203A]/g, "'")
    .replace(/[\u201C\u201D\u201E\u00AB\u00BB]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    // strip any remaining non-WinAnsi (keep printable ASCII + Latin-1 range;
    // tab/LF/CR are intentionally preserved)
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "");
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
