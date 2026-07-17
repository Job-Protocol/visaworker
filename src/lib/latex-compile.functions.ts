import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Server-side LaTeX compile.
// The active compiler uses latex-on-http's JSON resources API. Older deployments
// may still have LATEX_COMPILE_URL pointing at latexonline.cc, whose nginx body
// limit returns 413 for petition exhibit bundles; never use that host for the
// resources-based compile path.

// ---- Minimal POSIX ustar packer ---------------------------------------------
// Cloudflare Workers have no `tar` module. This writes a compliant uncompressed
// tar in-memory. latex-online accepts uncompressed tar via multipart upload.
function encStr(s: string, len: number): Uint8Array {
  const out = new Uint8Array(len);
  const enc = new TextEncoder().encode(s);
  out.set(enc.subarray(0, Math.min(enc.length, len)));
  return out;
}
function octal(n: number, len: number): Uint8Array {
  // NUL-terminated octal, right-aligned, zero-padded.
  const s = n.toString(8).padStart(len - 1, "0") + "\0";
  return new TextEncoder().encode(s);
}
function tarHeader(name: string, size: number): Uint8Array {
  const h = new Uint8Array(512);
  h.set(encStr(name, 100), 0);
  h.set(octal(0o644, 8), 100); // mode
  h.set(octal(0, 8), 108); // uid
  h.set(octal(0, 8), 116); // gid
  h.set(octal(size, 12), 124);
  h.set(octal(Math.floor(Date.now() / 1000), 12), 136);
  // checksum placeholder = 8 spaces
  for (let i = 148; i < 156; i++) h[i] = 0x20;
  h[156] = 0x30; // typeflag '0'
  h.set(encStr("ustar\0", 6), 257);
  h.set(encStr("00", 2), 263);
  let sum = 0;
  for (let i = 0; i < 512; i++) sum += h[i];
  h.set(octal(sum, 8), 148);
  return h;
}
function buildTar(files: Record<string, Uint8Array>): Uint8Array {
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (const [path, bytes] of Object.entries(files)) {
    const hdr = tarHeader(path, bytes.length);
    chunks.push(hdr, bytes);
    const pad = (512 - (bytes.length % 512)) % 512;
    if (pad) chunks.push(new Uint8Array(pad));
    total += 512 + bytes.length + pad;
  }
  // Two empty 512 blocks = end-of-archive.
  chunks.push(new Uint8Array(1024));
  total += 1024;
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

function decodeBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
// -----------------------------------------------------------------------------

const FilesRecord = z.record(z.string(), z.string());
const BinaryFilesRecord = z.record(z.string(), z.string()); // path → base64

export const compileLatex = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({
      files: FilesRecord,
      binaryFiles: BinaryFilesRecord.optional(),
      mainFile: z.string().default("main.tex"),
      command: z.enum(["pdflatex", "xelatex", "lualatex"]).default("pdflatex"),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    const endpoint = process.env.LATEX_COMPILE_URL || "https://latexonline.cc";
    const enc = new TextEncoder();
    const merged: Record<string, Uint8Array> = {};
    for (const [p, body] of Object.entries(data.files)) merged[p] = enc.encode(body);
    for (const [p, b64] of Object.entries(data.binaryFiles ?? {})) merged[p] = decodeBase64(b64);
    const tar = buildTar(merged);
    const fd = new FormData();
    fd.append("file", new Blob([tar.buffer as ArrayBuffer], { type: "application/x-tar" }), "project.tar");

    const url = new URL("/data", endpoint);
    url.searchParams.set("target", data.mainFile);
    url.searchParams.set("command", data.command);
    url.searchParams.set("force", "true");

    const res = await fetch(url.toString(), { method: "POST", body: fd });
    const ct = res.headers.get("content-type") || "";
    if (res.ok && ct.includes("application/pdf")) {
      const buf = new Uint8Array(await res.arrayBuffer());
      // base64-encode without blowing the stack on large PDFs.
      let s = "";
      const CHUNK = 0x8000;
      for (let i = 0; i < buf.length; i += CHUNK) {
        s += String.fromCharCode(...buf.subarray(i, i + CHUNK));
      }
      return { ok: true as const, base64: btoa(s), log: "" };
    }
    const log = await res.text();
    return { ok: false as const, base64: "", log: log || `HTTP ${res.status}` };
  });

// Compile a LaTeX project by handing the compile server a list of "resources":
// tex sources inline as strings, and binary attachments (exhibits) as URLs the
// server fetches directly. We target latex.ytotech.com (ytotech/latex-on-http)
// because latexonline.cc's public nginx caps upload bodies at ~1MB — bundling
// multi-MB exhibit PDFs into a single tarball upload returned 413. Passing
// signed URLs lets the compile server pull each exhibit itself, no size cap.
const CompileResourceSchema = z.union([
  z.object({ path: z.string(), content: z.string(), main: z.boolean().optional() }),
  z.object({ path: z.string(), url: z.string().url(), main: z.boolean().optional() }),
]);

export const compileLatexProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({
      resources: z.array(CompileResourceSchema).min(1),
      mainFile: z.string().default("main.tex"),
      command: z.enum(["pdflatex", "xelatex", "lualatex"]).default("pdflatex"),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    const configuredEndpoint = process.env.LATEX_COMPILE_URL || "";
    const defaultEndpoint = "https://latex.ytotech.com";
    const primaryEndpoint = configuredEndpoint && !configuredEndpoint.includes("latexonline.cc")
      ? configuredEndpoint
      : defaultEndpoint;
    const resources = data.resources.map((r) => {
      const isMain = r.main || r.path === data.mainFile;
      if ("content" in r) {
        return isMain ? { main: true, content: r.content } : { path: r.path, content: r.content };
      }
      return isMain
        ? { main: true, path: r.path, url: r.url }
        : { path: r.path, url: r.url };
    });

    const body = JSON.stringify({
      compiler: data.command,
      resources,
      options: {
        response: { log_files_on_failure: true, commands: true },
        compiler: { force: true, halt_on_error: false, silent: false },
      },
    });
    let res = await postToLatexOnHttp(primaryEndpoint, body);
    if (res.status === 413 && primaryEndpoint !== defaultEndpoint) {
      res = await postToLatexOnHttp(defaultEndpoint, body);
    }
    const ct = res.headers.get("content-type") || "";
    if (res.ok && ct.includes("application/pdf")) {
      const buf = new Uint8Array(await res.arrayBuffer());
      let s = "";
      const CHUNK = 0x8000;
      for (let i = 0; i < buf.length; i += CHUNK) {
        s += String.fromCharCode(...buf.subarray(i, i + CHUNK));
      }
      return { ok: true as const, base64: btoa(s), log: "" };
    }
    let log = "";
    try {
      const body = (await res.json()) as {
        logs?: { stdout?: string; stderr?: string };
        error?: string;
      };
      log = [body.logs?.stdout, body.logs?.stderr, body.error].filter(Boolean).join("\n");
    } catch {
      log = await res.text().catch(() => "");
    }
    return { ok: false as const, base64: "", log: log || `HTTP ${res.status}` };
  });

function postToLatexOnHttp(endpoint: string, body: string) {
  const base = endpoint.replace(/\/+$/, "");
  return fetch(`${base}/builds/sync`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}


