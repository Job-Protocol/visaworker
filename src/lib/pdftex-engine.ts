// SwiftLaTeX PdfTeX wrapper. Loads /swiftlatex/PdfTeXEngine.js once, keeps a
// warm engine singleton, and compiles a Record<path,string> project.

type Engine = {
  loadEngine: () => Promise<void>;
  flushCache: () => void;
  makeMemFSFolder: (path: string) => void;
  writeMemFSFile: (path: string, src: string | Uint8Array) => void;
  setEngineMainFile: (path: string) => void;
  compileLaTeX: () => Promise<{ status: number; pdf?: Uint8Array; log: string }>;
};

declare global {
  interface Window {
    PdfTeXEngine?: new () => Engine;
  }
}

let scriptPromise: Promise<void> | null = null;
let enginePromise: Promise<Engine> | null = null;

function loadScript(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    if (window.PdfTeXEngine) return resolve();
    const s = document.createElement("script");
    s.src = "/swiftlatex/PdfTeXEngine.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load SwiftLaTeX engine script"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export async function getReadyEngine(): Promise<Engine> {
  if (enginePromise) return enginePromise;
  enginePromise = (async () => {
    await loadScript();
    if (!window.PdfTeXEngine) throw new Error("PdfTeXEngine not available");
    const engine = new window.PdfTeXEngine();
    await engine.loadEngine();
    return engine;
  })();
  return enginePromise;
}

export type CompileResult = {
  ok: boolean;
  pdf?: Uint8Array;
  log: string;
};

export async function compileProject(
  files: Record<string, string | Uint8Array>,
  mainFile: string,
): Promise<CompileResult> {
  const engine = await getReadyEngine();
  engine.flushCache();
  const dirs = new Set<string>();
  for (const path of Object.keys(files)) {
    const parts = path.split("/");
    parts.pop();
    if (parts.length) dirs.add(parts.join("/"));
  }
  for (const d of dirs) {
    try {
      engine.makeMemFSFolder(d);
    } catch {
      /* ignore duplicates */
    }
  }
  for (const [path, src] of Object.entries(files)) {
    engine.writeMemFSFile(path, src);
  }
  engine.setEngineMainFile(mainFile);
  const result = await engine.compileLaTeX();
  return {
    ok: result.status === 0 && !!result.pdf,
    pdf: result.pdf,
    log: result.log || "",
  };
}

export function extractErrorLines(log: string, max = 5): string[] {
  const out: string[] = [];
  const lines = log.split(/\r?\n/);
  for (let i = 0; i < lines.length && out.length < max; i++) {
    if (lines[i].startsWith("!")) {
      const chunk = [lines[i]];
      for (let j = 1; j < 3 && i + j < lines.length; j++) chunk.push(lines[i + j]);
      out.push(chunk.join(" ").trim());
    }
  }
  return out;
}
