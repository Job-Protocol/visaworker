#!/usr/bin/env node
/**
 * Derives an OSS-safe `src/integrations/supabase/types.ts` by stripping
 * enterprise-only tables and columns listed in docs/oss/ee-db-manifest.json
 * from the checked-in generated types file.
 *
 * Usage:
 *   node scripts/generate-open-types.mjs \
 *     --in src/integrations/supabase/types.ts \
 *     --out /tmp/open-repo/src/integrations/supabase/types.ts
 *
 * This is intentionally a structural transform on the generated file rather
 * than an AST rewrite: the Supabase codegen output has a predictable shape
 * ("<name>: {\n  Row: { ... }\n  Insert: { ... }\n  Update: { ... }\n  ...\n}")
 * and we only need to snip whole named blocks and named lines.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--in") out.in = argv[++i];
    else if (a === "--out") out.out = argv[++i];
    else if (a === "--manifest") out.manifest = argv[++i];
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const inPath = resolve(args.in ?? "src/integrations/supabase/types.ts");
const outPath = resolve(args.out ?? "src/integrations/supabase/types.ts");
const manifestPath = resolve(
  args.manifest ?? "docs/oss/ee-db-manifest.json",
);

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const src = readFileSync(inPath, "utf8");

/**
 * Strip a top-level named block like `foo_table: { ... }` from within the
 * `Tables:` / `Functions:` object literal. Brace-counts to find the block's end.
 */
function stripNamedBlock(source, name) {
  // Match `      <name>: {` with any indent.
  const re = new RegExp(`^([ \\t]+)${name}: \\{`, "m");
  const m = re.exec(source);
  if (!m) return source;

  const start = m.index;
  let i = m.index + m[0].length;
  let depth = 1;
  while (i < source.length && depth > 0) {
    const c = source[i];
    if (c === "{") depth++;
    else if (c === "}") depth--;
    i++;
  }
  // Consume trailing newline.
  if (source[i] === "\n") i++;
  return source.slice(0, start) + source.slice(i);
}

/**
 * Strip a single-line column declaration like `      credit_cents: number | null`
 * (and any adjoining Insert/Update mirror lines) from a specific table's block.
 * For safety we only remove lines whose key exactly matches under any of
 * Row/Insert/Update within the table block.
 */
function stripColumnFromTable(source, tableName, columnName) {
  const tableRe = new RegExp(`^([ \\t]+)${tableName}: \\{`, "m");
  const m = tableRe.exec(source);
  if (!m) return source;
  const start = m.index + m[0].length;
  let i = start;
  let depth = 1;
  while (i < source.length && depth > 0) {
    const c = source[i];
    if (c === "{") depth++;
    else if (c === "}") depth--;
    i++;
  }
  const block = source.slice(start, i);
  const lineRe = new RegExp(
    `^[ \\t]+${columnName}\\??: [^\\n]*\\n`,
    "gm",
  );
  const stripped = block.replace(lineRe, "");
  return source.slice(0, start) + stripped + source.slice(i);
}

let out = src;
for (const t of manifest.tables ?? []) out = stripNamedBlock(out, t);
for (const f of manifest.functions ?? []) out = stripNamedBlock(out, f);
for (const [table, cols] of Object.entries(manifest.columns ?? {})) {
  if (table.startsWith("$")) continue;
  for (const c of cols) out = stripColumnFromTable(out, table, c);
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, out);

const removed = {
  tables: manifest.tables?.length ?? 0,
  functions: manifest.functions?.length ?? 0,
  columns: Object.entries(manifest.columns ?? {})
    .filter(([k]) => !k.startsWith("$"))
    .reduce((n, [, cols]) => n + cols.length, 0),
};
console.log(
  `open-types: wrote ${outPath} (stripped ${removed.tables} tables, ${removed.functions} functions, ${removed.columns} columns)`,
);
