// Agent tools — schemas for Anthropic + executor that runs against a user-scoped Supabase client.
// Server-only.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { buildTemplate, texEscape, type TemplateInput } from "./template-engine";
import { extractAttachmentText } from "./attachments-extract.server";

export type SB = SupabaseClient<Database>;

export const SYSTEM_PROMPT = `You are visaworker.ai, an AI paralegal that drafts U.S. immigration petitions (O-1A, EB-1A, EB-2 NIW) as LaTeX documents. Your goal on every case is a USCIS-ready brief where every factual claim is backed by an exhibit and every legal claim is anchored in the regulation, Policy Manual, or precedent decision it relies on.

You always work inside a single project. Every tool call is auto-scoped — never ask which project.

# Operating loop
1. Survey with get_document_outline before touching anything unfamiliar. Use search_document / search_exhibits to locate text; use get_sections_bulk to load several related sections at once. Do NOT dump every section into context.
2. Make surgical edits — replace_in_section, insert_in_section, apply_patch. Reserve upsert_section for brand-new sections or true full rewrites.
3. Keep the strategy doc current. It is your working memory AND the user's source of truth for where the case stands. Canonical shape (never deviate):
   \`\`\`
   {one-paragraph case theory}

   ## Plan
   {2–5 bullets: which criteria/prongs we're leaning on and why}

   ## Criteria
   {one line per criterion or Dhanasar prong: status (met / partial / missing) + a sentence on the evidence or gap}

   ## Recommenders
   {suggested signer profiles: name (or "TBD"), affiliation, why they fit, letter status}

   ## To do
   - [ ] user-facing evidence asks and open questions (GitHub checkboxes)

   ## Notes
   {decisions, dead ends, ad-hoc observations}
   \`\`\`
   Choosing the right tool:
   - \`read_strategy\` at the start of most turns — it's cheap.
   - \`patch_strategy\` (DEFAULT) to update one whole section — Plan, Criteria, Recommenders, To do, or Notes.
   - \`append_strategy\` only for adding a single bullet / checkbox to \`## To do\` or \`## Notes\`.
   - \`write_strategy\` ONLY on kickoff (seeding the doc) or to restore the canonical schema when an H2 is missing / the doc has drifted structurally. Never for routine updates.
   Update triggers (advisory — no strict bidirectional sync): you learned a new fact, drafted or edited a section, attached/removed an exhibit, hit an evidence gap, created a \`\\todo{}\`, marked a claim unverified, drafted or sent a letter. Don't wait to be asked.
4. Call navigate_to once at the end of a mutating turn so the user lands on the right tab: "sections" after drafting/editing, "exhibits" after exhibit or letter changes, "strategy" after strategy updates, "preview" only when the user asked to see the PDF.
5. **You never call request_compile.** The system compiles the petition automatically at the end of any turn that mutated content, and hands you the result. If the compile fails, you will receive a plain-text summary as your next input — read it, use get_last_compile / get_rendered_latex to inspect, fix the offending section with a surgical edit, and stop. The system will recompile. After several failed auto-compiles the system surfaces the failure to the user; you don't need to manage that budget yourself.

# Legal framing (visa-specific)
- **O-1A**: satisfy at least 3 of 8 evidentiary criteria at 8 CFR §214.2(o)(3)(iii), then a final merits determination of sustained national or international acclaim. Kazarian-style two-step.
- **EB-1A**: satisfy at least 3 of 10 criteria at 8 CFR §204.5(h)(3), then Kazarian final merits determination of sustained acclaim and rise to the very top of the field.
- **EB-2 NIW**: qualify as EB-2 (advanced degree or exceptional ability under §204.5(k)), then Matter of Dhanasar's three prongs — (1) substantial merit and national importance, (2) well-positioned to advance the endeavor, (3) on balance beneficial to the U.S. to waive the labor certification.
- Quote the regulation verbatim inside \`\\begin{quote}...\\end{quote}\` before applying it. Cite 8 CFR §204.5(h)/(k), the USCIS Policy Manual (Volume 6 for employment-based), and AAO decisions where relevant. Structure criterion sections as IRAC: state the criterion, quote it, apply the evidence with \\exhibitp{} cites, conclude.
- Avoid puffery — "world-renowned", "unparalleled", "visionary", "revolutionized". Let the numbers, contracts, citations, and independent recognition carry the weight.

# Evidence discipline
- Every concrete published item you narrate (article, podcast, award, patent, profile, video, dataset) MUST be an exhibit and cited with \\exhibitp{label}. If a source is a URL and no matching exhibit exists yet, call capture_url_as_exhibit BEFORE writing the sentence.
- When the user says "add the exhibits", "cite the sources", "back this up" — CREATE the missing exhibits (capture_url_as_exhibit / attach_exhibit_from_upload) and then weave in \\exhibitp{} cites. Don't just re-reference exhibits that already exist.
- Never fabricate exhibit labels, recommenders, credentials, or citations. If a claim has no URL and no upload behind it, add it to \`## To do\` in the strategy doc (\`patch_strategy\` or \`append_strategy\`) and ask the user for the source — do not write it into the petition as if evidenced.
- Exhibit labels are stable opaque IDs. Never rewrite a citation because an exhibit moved, was renamed, or was replaced — display numbers are derived from position at render time.

# Talking to the user
- Default reply: 1–3 sentences describing what changed and what's next. Save long explanations for when the user asks.
- When a request is ambiguous, ask ONE focused question rather than guessing across multiple sections. On the first turn of a new free-tier case, a well-scoped question up front beats three exploratory turns.
- Never paste raw TeX, pdflatex logs, or tool JSON at the user. Translate to plain English: what broke, which section, what you're doing about it.
- Chat replies mirror the user's language and register. Petition prose is always formal U.S. legal English regardless of the user's chat style.
- When you mention a workspace tab in your reply, link the tab name so the user can click straight to it: \`[Strategy](vw:strategy)\`, \`[Exhibits](vw:exhibits)\`, \`[Sections](vw:sections)\`, or \`[Preview](vw:preview)\`. Only link the tab word itself, and only when it's genuinely useful for the user to open that tab next.


# Bias to drafting (do not linger in intake)
- Default posture is DRAFT, not INTERVIEW. As soon as you have enough to write a defensible first pass of a section, write it — then flag the gaps in the strategy doc and ask for what's missing. A rough drafted section with \\todo{...} markers and open questions is more useful than another round of questions.
- Trigger to start drafting: you know the visa category and have any one of — a CV/resume, a LinkedIn, a personal statement, an uploaded prior petition, or ~3+ concrete facts about the beneficiary's work. Do not wait for "complete" information; it never arrives.
- Per turn, ask AT MOST one focused question, and only when the answer would change what you draft next. Otherwise: draft, then list the open questions at the end of the reply as a short bulleted list.
- Never respond with only questions on a turn where you could have drafted or updated the strategy doc. "Collecting more info" is not an acceptable outcome for a turn — produce an artifact (a section, a strategy update, an exhibit capture, a letter draft) every turn.
- Use \\todo{describe the gap} inline in drafted sections for missing facts/exhibits, and mirror each \\todo into the strategy \`## To do\` list. When you later resolve a \\todo, tick or remove the matching \`## To do\` item on the same turn.
- When the reply would end with "which would you prefer?" or a numbered "Option 1 / Option 2" list, call \`suggest_next_steps\` INSTEAD. Give each option a short imperative chip label (≤40 chars) and the exact user prompt to send if tapped. Never emit both chips and an Option-1/Option-2 paragraph — chips replace that prose entirely. Only use chips for real branches; if there is one obvious next move, just do it.

# Candor over agreeableness
- You are a paralegal, not a cheerleader. USCIS officers are skeptical readers — your job is to surface weaknesses BEFORE they do, not to reassure the user their case is stronger than it is.
- Do not congratulate, hype, or validate ("great case", "you clearly qualify", "this is a strong O-1A profile") unless the evidence in the project genuinely supports it. Absence of evidence is not evidence of strength.
- When the user's evidence is thin, say so plainly: name the criterion, name what's missing, and say what would fix it. "You have 1 of 3 criteria clearly met; press/awards/judging are unsupported" beats "looking good, let's keep going".
- Disagree with the user when they're wrong on the law, the facts, or the strategy. Cite the regulation or the AAO decision and hold the line. Do not fold because they pushed back.
- Prefer accurate over encouraging. If a claim is puffery, unsupported, or legally weak, flag it — even if the user wrote it themselves.
- Never predict approval, denial, or odds. USCIS adjudication is discretionary; say what the record supports and what it doesn't, and stop there.



# LaTeX style (the preamble is fixed — you only write body content)
- Paragraphs: block style. One blank line between paragraphs (parskip handles spacing). NEVER \`\\\\\` for paragraph breaks, NEVER \`\\indent\`, NEVER \`\\newpage\` between sections.
- Headings: \`\\section{...}\` top-level (numbered, in TOC), \`\\subsection{...}\` for named sub-parts in the TOC, \`\\subsubsection{...}\` (italic) for finer sub-parts. For an inline lead-in that should NOT appear in the TOC, use a bold run-in paragraph: \`\\medskip\\noindent\\textbf{Barry Asin — Chief Analyst.} Body continues on the same line…\`
- Cross-refs: refer to sections by label (\`Section~\\ref{sec:benefit}, p.~\\pageref{sec:benefit}\`). Refer to exhibits ONLY via \\exhibit{label} / \\exhibitref{label} / \\exhibitp{label} — never a literal "Exhibit 12". Always use a non-breaking tilde \`~\` before \\ref, \\pageref, and every exhibit macro.
- Lists: enumitem only. \`\\begin{itemize}[leftmargin=*, itemsep=2pt]\` / \`\\begin{enumerate}[leftmargin=*, itemsep=4pt]\`. Never fake bullets with • or -.
- Block quotes: every regulation, Policy Manual passage, or letter excerpt goes inside \`\\begin{quote}...\\end{quote}\`.
- Tables: booktabs only — \`\\toprule / \\midrule / \\bottomrule\`, no vertical lines, no \`\\hline\`. Fixed-width \`p{Xcm}\` columns. Centered. Bold header row.
- Specials: § → \`\\S{}\` (e.g. \`8 CFR\\S{}204.5(h)(3)\`), € → \`\\euro{}\`. Always escape \`\\$ \\% \\& \\# \\_\`. Em dash \`---\`, en dash / ranges \`--\` (\`2019--2021\`). Curly quotes only: \`\`text'' and \`text'. NEVER straight quotes.

# Attachments (PDF / DOCX / TXT / MD)
- read_exhibit and get_upload return cached extracted text with paging.
- For an uploaded source, decide: attach_exhibit_from_upload to make it a citable exhibit, import_upload_as_section (style="prose") to fold it into a new section, or just read it for context.
- DOCX/TXT/MD exhibits render as inline LaTeX in the exported PDF — no extra work needed.

# Asking the user for documents (ALWAYS use request_documents)
- Whenever you need the user to upload ANY file — even one — call the \`request_documents\` tool. It renders an inline drop-zone checklist in the chat. NEVER ask for uploads in plain prose ("please send me your CV, passport, and three publications") — the user has no upload button in the chat and will be confused.
- Bite-sized batches only: request 2–4 items at a time, tightly scoped to what unblocks your very next drafting step. Do NOT dump a 10–15 item "everything we'll ever need" checklist up front — it overwhelms users and stalls the case.
  - Kickoff batch: the minimum to start drafting (typically CV + passport bio page + LinkedIn export or personal statement). Then draft.
  - Follow-up batches: after each drafting pass, request only the exhibits needed for the criteria you're actively working on (e.g. "3 press pieces about you" OR "your two strongest award certificates" — not both at once).
- Pair every request_documents call with a one-sentence chat reply explaining why you need these specific items right now. Then stop and wait — the next user turn will summarize what arrived.
- If the user pastes a URL or mentions a public source, prefer capture_url_as_exhibit over asking them to download and upload it.

# Letters (recommendation or expert)
- Typical flow: create_letter with signer/recommender profile → gather context (read_strategy, list_exhibits, read_exhibit) → update_letter with body_md in the signer's first-person voice → **confirm with the user** → send_letter_for_review to mint a review link.
- Never send a letter for review without explicit user approval.
- Never fabricate a signer or recommender. If profile fields are missing, ask.
- Signed letters auto-appear as numbered exhibits and are citable via \\exhibit{} like any other exhibit.

# Don'ts
- Don't call request_compile — auto-compile is on. If the model emits it anyway the system treats it as a no-op.
- Don't rewrite whole sections when a surgical edit works.
- Don't narrate intermediate tool calls, validation output, or compile attempts.
- Don't invent exhibits, recommenders, quotes, or citations.
- Don't leave straight quotes, unescaped \`$ % & # _\`, \`\\\\\`, \`\\indent\`, \`\\newpage\`, or fake bullets.
- Don't ask which project — scope is automatic.`;

// Names of tools that mutate petition content. If any of these run during a
// turn, the runtime auto-compiles at end of turn.
export const MUTATING_TOOL_NAMES = new Set<string>([
  "upsert_section",
  "replace_in_section",
  "insert_in_section",
  "apply_patch",
  "delete_section",
  "reorder_sections",
  "import_upload_as_section",
  "attach_exhibit_from_upload",
  "capture_url_as_exhibit",
  "rename_exhibit",
  "tag_exhibit",
  "send_letter_for_review",
]);

// ---------- Tool schemas (Anthropic tool_use format) ----------

export const TOOLS = [
  // ---- Project & profile
  {
    name: "get_project",
    description: "Return the project metadata (name, visa type, beneficiary, field, profile_data).",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "set_profile_data",
    description:
      "Merge fields into the project's profile_data JSON (intake info: employer, prior visas, achievements summary, etc).",
    input_schema: {
      type: "object",
      properties: { patch: { type: "object" } },
      required: ["patch"],
    },
  },

  // ---- Sections: read
  {
    name: "list_sections",
    description: "List all sections in this petition with id, key, title, order.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_document_outline",
    description:
      "Condensed outline of the whole petition: section_key, title, order, line/word counts, first 200 chars. Use this to survey a long project cheaply.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_section",
    description: "Return the full LaTeX body of one section by section_key.",
    input_schema: {
      type: "object",
      properties: { section_key: { type: "string" } },
      required: ["section_key"],
    },
  },
  {
    name: "get_sections_bulk",
    description: "Return full bodies for multiple section_keys in one call. Token-efficient context loading.",
    input_schema: {
      type: "object",
      properties: { section_keys: { type: "array", items: { type: "string" } } },
      required: ["section_keys"],
    },
  },
  {
    name: "search_document",
    description:
      "Grep across every section's tex_body and title. Returns [{section_key, title, line, column, snippet}]. Use before editing to locate text.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string" },
        is_regex: { type: "boolean" },
        case_sensitive: { type: "boolean" },
        max_matches: { type: "integer" },
      },
      required: ["query"],
    },
  },

  // ---- Sections: write
  {
    name: "upsert_section",
    description:
      "Create or replace a full section. Use snake_case section_key. tex_body is raw LaTeX (do NOT include \\section{...} — the template adds it). Prefer replace_in_section / apply_patch for edits.",
    input_schema: {
      type: "object",
      properties: {
        section_key: { type: "string" },
        title: { type: "string" },
        tex_body: { type: "string" },
        order_index: { type: "integer" },
      },
      required: ["section_key", "title", "tex_body"],
    },
  },
  {
    name: "replace_in_section",
    description:
      "Surgical find/replace inside one section. If expected_count is set and match count differs, the edit is rejected (safety guard).",
    input_schema: {
      type: "object",
      properties: {
        section_key: { type: "string" },
        find: { type: "string" },
        replace: { type: "string" },
        is_regex: { type: "boolean" },
        occurrence: { type: "string", enum: ["first", "all"] },
        expected_count: { type: "integer" },
      },
      required: ["section_key", "find", "replace"],
    },
  },
  {
    name: "insert_in_section",
    description:
      "Insert text into a section without touching the rest. position: 'start' | 'end' | { after_line: N } | { before_pattern: 'regex' }.",
    input_schema: {
      type: "object",
      properties: {
        section_key: { type: "string" },
        position: {
          oneOf: [
            { type: "string", enum: ["start", "end"] },
            { type: "object", properties: { after_line: { type: "integer" } }, required: ["after_line"] },
            { type: "object", properties: { before_pattern: { type: "string" } }, required: ["before_pattern"] },
          ],
        },
        text: { type: "string" },
      },
      required: ["section_key", "position", "text"],
    },
  },
  {
    name: "apply_patch",
    description:
      "Apply sequential find/replace hunks to one section in one call. hunks: [{ find, replace, is_regex? }]. Fails atomically if any hunk misses.",
    input_schema: {
      type: "object",
      properties: {
        section_key: { type: "string" },
        hunks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              find: { type: "string" },
              replace: { type: "string" },
              is_regex: { type: "boolean" },
            },
            required: ["find", "replace"],
          },
        },
      },
      required: ["section_key", "hunks"],
    },
  },
  {
    name: "delete_section",
    description: "Delete a section by section_key.",
    input_schema: {
      type: "object",
      properties: { section_key: { type: "string" } },
      required: ["section_key"],
    },
  },
  {
    name: "reorder_sections",
    description: "Rewrite order_index for all sections in one transaction. Pass an ordered list of section_keys.",
    input_schema: {
      type: "object",
      properties: { ordered_keys: { type: "array", items: { type: "string" } } },
      required: ["ordered_keys"],
    },
  },

  // ---- Rendered LaTeX + compile memory
  {
    name: "get_rendered_latex",
    description:
      "Return the concatenated .tex the compiler actually sees (preamble + all sections). Optional line_range: [start, end] or around_line + context to zoom in on a compile error.",
    input_schema: {
      type: "object",
      properties: {
        line_range: { type: "array", items: { type: "integer" }, minItems: 2, maxItems: 2 },
        around_line: { type: "integer" },
        context: { type: "integer" },
      },
    },
  },
  {
    name: "get_last_compile",
    description: "Return the most recent compile run: status, log tail, error_lines, pdf_path, timing.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_compile_history",
    description: "Summary of the last N compile runs (default 10). See if a recent edit made things worse.",
    input_schema: {
      type: "object",
      properties: { limit: { type: "integer" } },
    },
  },

  // ---- Exhibits
  {
    name: "list_exhibits",
    description: "List all exhibits with label, title, page count, and tags.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_exhibit_citations",
    description:
      "Scan all sections for \\exhibit{...} / \\exhibitp{...} and cross-check against the exhibits table. Returns {used, orphaned, unused}. Run before request_compile.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "read_exhibit",
    description:
      "Extract text from an exhibit (PDF, DOCX, TXT, or MD), cached after first read. Supports paging via offset (default 0) + length (default 8000). Returns mime_type, page_count, total_chars, next_offset.",
    input_schema: {
      type: "object",
      properties: {
        label: { type: "string" },
        offset: { type: "integer" },
        length: { type: "integer" },
      },
      required: ["label"],
    },
  },
  {
    name: "read_exhibit_pdf",
    description: "DEPRECATED alias for read_exhibit. Prefer read_exhibit.",
    input_schema: {
      type: "object",
      properties: {
        label: { type: "string" },
        offset: { type: "integer" },
        length: { type: "integer" },
      },
      required: ["label"],
    },
  },
  {
    name: "search_exhibits",
    description:
      "Substring/regex search across the cached extracted text of all exhibits. Returns matching labels + snippets. Use to find evidence supporting a claim.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string" },
        is_regex: { type: "boolean" },
        case_sensitive: { type: "boolean" },
        max_matches: { type: "integer" },
      },
      required: ["query"],
    },
  },
  {
    name: "tag_exhibit",
    description: "Attach tags to an exhibit (e.g. 'award', 'authorship', 'press').",
    input_schema: {
      type: "object",
      properties: {
        label: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
      },
      required: ["label", "tags"],
    },
  },
  {
    name: "rename_exhibit",
    description:
      "Rename an exhibit's human-readable title (e.g. 'Nature 2023 paper on X'). Does NOT change the ex## label — citations via \\exhibit{label} keep working.",
    input_schema: {
      type: "object",
      properties: {
        label: { type: "string", description: "The stable ex## label of the exhibit." },
        title: { type: "string", description: "New human-readable title. 1-200 chars." },
      },
      required: ["label", "title"],
    },
  },

  // ---- Uploads
  {
    name: "list_uploads",
    description: "List non-exhibit source docs (CV, LinkedIn export, notes).",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_upload",
    description:
      "Return an upload's metadata and extracted text (paged). offset (default 0) + length (default 8000).",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string" },
        offset: { type: "integer" },
        length: { type: "integer" },
      },
      required: ["id"],
    },
  },
  {
    name: "import_upload_as_section",
    description:
      "Create or replace a section built from an upload's extracted text. style='verbatim' inserts the raw text in a quote block; style='prose' returns the text for you to rewrite (no section is created — call upsert_section after).",
    input_schema: {
      type: "object",
      properties: {
        upload_id: { type: "string" },
        section_key: { type: "string" },
        title: { type: "string" },
        style: { type: "string", enum: ["verbatim", "prose"] },
      },
      required: ["upload_id", "section_key", "title"],
    },
  },
  {
    name: "attach_exhibit_from_upload",
    description:
      "Promote an existing upload into a numbered exhibit. Copies the storage object into the exhibits bucket, assigns the next ex## label, reuses the cached extracted text.",
    input_schema: {
      type: "object",
      properties: {
        upload_id: { type: "string" },
        title: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
      },
      required: ["upload_id"],
    },
  },

  // ---- Web capture (Firecrawl)
  {
    name: "capture_url_as_exhibit",
    description:
      "Scrape a public webpage with Firecrawl and store a full-page screenshot + extracted markdown as a numbered exhibit. Use for press coverage, conference programs, judging panels, faculty pages, GitHub/Crunchbase pages, etc. Captures the logged-out view — will not work for auth-walled content.",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string" },
        title: { type: "string" },
      },
      required: ["url"],
    },
  },

  // ---- Static validation
  {
    name: "validate_latex",
    description:
      "Fast static checks (no pdflatex): balanced braces / begin-end, unescaped special chars outside math, undefined exhibit labels. Pass section_key to scope; omit for whole doc.",
    input_schema: {
      type: "object",
      properties: { section_key: { type: "string" } },
    },
  },

  // ---- Strategy doc (agent's working memory)
  {
    name: "read_strategy",
    description:
      "Return the current strategy markdown for this project (plan, to-do list, notes). Cheap — call at the start of most turns.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "write_strategy",
    description:
      "Replace the entire strategy markdown. Use ONLY to seed the doc on kickoff or to restore the canonical schema (Plan / Criteria / Recommenders / To do / Notes) when it has drifted structurally. For routine section updates use patch_strategy; for one-off bullets use append_strategy.",
    input_schema: {
      type: "object",
      properties: { content: { type: "string" } },
      required: ["content"],
    },
  },
  {
    name: "patch_strategy",
    description:
      "Replace one whole H2 section of the strategy doc (Plan / Criteria / Recommenders / To do / Notes). This is the DEFAULT tool for routine strategy updates — surgical, no whole-doc rewrite, no blind append. Provide the section body only (no heading line — the '## Section' heading is added automatically). If the section doesn't exist yet, it is created in canonical order. The pre-heading case-theory paragraph is preserved untouched.",
    input_schema: {
      type: "object",
      properties: {
        section: {
          type: "string",
          enum: ["Plan", "Criteria", "Recommenders", "To do", "Notes"],
          description: "Which canonical H2 section to replace.",
        },
        content: {
          type: "string",
          description: "Markdown body for that section (no heading line).",
        },
      },
      required: ["section", "content"],
    },
  },
  {
    name: "append_strategy",
    description:
      "Append a single bullet or short note to the end of the strategy doc (a leading newline is added). Use for a one-off addition to '## To do' or '## Notes'. For updating a whole section use patch_strategy.",
    input_schema: {
      type: "object",
      properties: { content: { type: "string" } },
      required: ["content"],
    },
  },

  // ---- Letters
  {
    name: "list_letters",
    description:
      "List all letters (recommendation or expert) in this project with signer/recommender profile and status (draft/awaiting_review/changes_requested/signed/superseded).",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "read_letter",
    description:
      "Return one letter's full body_md, signer/recommender profile, status, and last 20 events (comments included).",
    input_schema: {
      type: "object",
      properties: { letter_id: { type: "string" } },
      required: ["letter_id"],
    },
  },
  {
    name: "create_letter",
    description:
      "Create a new draft letter for a signer/recommender (or expert). All profile fields are optional but recommender_name and recommender_email should be provided before sending.",
    input_schema: {
      type: "object",
      properties: {
        recommender_name: { type: "string" },
        recommender_email: { type: "string" },
        recommender_title: { type: "string" },
        recommender_org: { type: "string" },
        relationship: { type: "string" },
        notes: { type: "string" },
      },
    },
  },
  {
    name: "update_letter",
    description:
      "Patch a letter's subject, body_md, or signer/recommender profile fields. Use to write/replace the draft after gathering context via read_strategy + list_exhibits.",
    input_schema: {
      type: "object",
      properties: {
        letter_id: { type: "string" },
        subject: { type: "string" },
        body_md: { type: "string" },
        recommender_name: { type: "string" },
        recommender_email: { type: "string" },
        recommender_title: { type: "string" },
        recommender_org: { type: "string" },
        relationship: { type: "string" },
        notes: { type: "string" },
      },
      required: ["letter_id"],
    },
  },
  {
    name: "send_letter_for_review",
    description:
      "Mint a public review link for the signer/recommender. Returns the URL for the user to send. Any previous link on this letter is revoked.",
    input_schema: {
      type: "object",
      properties: { letter_id: { type: "string" }, origin: { type: "string" } },
      required: ["letter_id"],
    },
  },

  // ---- Document collection widget
  {
    name: "request_documents",
    description:
      "Show an inline document-upload checklist to the user in the chat. ALWAYS use this tool — never ask for uploads in plain prose — whenever you need the user to send you a file (CV, passport, publications, award certificates, prior petition, etc.), even for a single item. The user sees a widget with a drop zone per item plus a free drop for extras; on the next turn a follow-up user message will summarize what arrived. Keep each request bite-sized: 2–4 items scoped to what unblocks your very next drafting step. Do NOT emit a 10+ item 'everything you'll ever need' checklist — split into successive batches across turns.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Optional heading shown above the checklist, e.g. 'Documents needed to start your EB-1A'." },
        items: {
          type: "array",
          description: "Checklist of requested documents.",
          items: {
            type: "object",
            properties: {
              key: { type: "string", description: "Short stable slug, e.g. 'cv', 'passport', 'award_letter_1'." },
              label: { type: "string", description: "Human-readable name shown to the user." },
              description: { type: "string", description: "Optional one-line hint." },
              required: { type: "boolean", description: "Whether this item is required (default true)." },
            },
            required: ["key", "label"],
          },
        },
      },
      required: ["items"],
    },
  },

  // ---- Navigation
  {
    name: "navigate_to",
    description:
      "Switch the user's workspace to the most relevant tab so they immediately see the change you just made. Call this AFTER mutating content — right before request_compile when you'll compile, or at the end of a read-only turn that produced a strategy update. Choose 'exhibits' after adding/removing/renaming exhibits or letters, 'strategy' after updating the strategy doc, 'sections' after drafting/editing sections, or 'preview' when the freshly compiled PDF is the thing to look at. Skip on trivial turns (pure Q&A, unchanged content).",
    input_schema: {
      type: "object",
      properties: {
        pane: {
          type: "string",
          enum: ["strategy", "exhibits", "sections", "preview"],
          description: "Which workspace tab to open.",
        },
      },
      required: ["pane"],
    },
  },

  // ---- Next-step chips
  {
    name: "suggest_next_steps",
    description:
      "End a turn that would otherwise ask 'which would you prefer?' by offering the user 2–4 short next-step chips in the chat. The user taps one and it is sent as their next message verbatim. Use ONLY when the natural next move genuinely branches (e.g. draft Awards now vs wait for the fellowship certificate). Do NOT use for yes/no confirmations, and do NOT use when there is one obvious next step — just do it. When you emit this tool, do NOT also write an 'Option 1 / Option 2' paragraph in the reply; the chips REPLACE that prose.",
    input_schema: {
      type: "object",
      properties: {
        suggestions: {
          type: "array",
          minItems: 2,
          maxItems: 4,
          description: "2–4 mutually distinct next steps.",
          items: {
            type: "object",
            properties: {
              label: {
                type: "string",
                description: "Short imperative chip label (≤40 chars), e.g. 'Draft Awards section now'.",
              },
              prompt: {
                type: "string",
                description: "Exact user message to send if this chip is tapped.",
              },
            },
            required: ["label", "prompt"],
          },
        },
      },
      required: ["suggestions"],
    },
  },

  {
    name: "request_compile",
    description:
      "Ask the browser to compile the petition. Your turn PAUSES here; on resume you get the compile log and a page-count summary.",
    input_schema: {
      type: "object",
      properties: { reason: { type: "string" } },
      required: ["reason"],
    },
  },
] as const;

// ---------- Helpers ----------

async function loadBundle(supabase: SB, projectId: string): Promise<TemplateInput> {
  const [{ data: project }, { data: sections }, { data: exhibits }] = await Promise.all([
    supabase.from("projects").select("*").eq("id", projectId).maybeSingle(),
    supabase.from("sections").select("*").eq("project_id", projectId).order("order_index"),
    supabase.from("exhibits").select("*").eq("project_id", projectId).order("order_index"),
  ]);
  if (!project) throw new Error("project not found");
  const exhibitList = (exhibits ?? []) as any[];
  // Load cached extracted text for any non-PDF exhibit so the template can inline it.
  const nonPdfIds = exhibitList
    .filter((e) => e.mime_type && e.mime_type !== "application/pdf")
    .map((e) => e.id);
  const cacheById = new Map<string, string>();
  if (nonPdfIds.length) {
    const { data: caches } = await supabase
      .from("exhibit_cache")
      .select("exhibit_id, extracted_text")
      .in("exhibit_id", nonPdfIds);
    for (const c of caches ?? []) {
      cacheById.set((c as any).exhibit_id, (c as any).extracted_text ?? "");
    }
  }
  return {
    project: project as any,
    sections: (sections ?? []) as any,
    exhibits: exhibitList.map((e) => ({
      ...e,
      extracted_text: cacheById.get(e.id) ?? null,
    })) as any,
  };
}

function toRegex(query: string, isRegex: boolean, caseSensitive: boolean, global = true): RegExp {
  const pattern = isRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const flags = (global ? "g" : "") + (caseSensitive ? "" : "i");
  return new RegExp(pattern, flags);
}

function findMatches(text: string, re: RegExp, max: number) {
  const lines = text.split("\n");
  const offsets: number[] = [0];
  for (let i = 0; i < lines.length; i++) offsets.push(offsets[i] + lines[i].length + 1);
  const results: { line: number; column: number; snippet: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const idx = m.index;
    let line = 0;
    while (line + 1 < offsets.length && offsets[line + 1] <= idx) line++;
    const column = idx - offsets[line];
    const snippet = lines[line]?.slice(Math.max(0, column - 40), column + m[0].length + 40) ?? "";
    results.push({ line: line + 1, column: column + 1, snippet });
    if (results.length >= max) break;
    if (m[0].length === 0) re.lastIndex++;
  }
  return results;
}

function texEscapeMultiline(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => texEscape(p.trim()).replace(/\n/g, " \\\\\n"))
    .filter(Boolean)
    .join("\n\n");
}

function extractCitedLabels(text: string): string[] {
  const out = new Set<string>();
  const re = /\\exhibitp?\{([^}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.add(m[1].trim());
  return [...out];
}

function staticValidate(body: string): Array<{ severity: string; line: number; message: string }> {
  const issues: Array<{ severity: string; line: number; message: string }> = [];
  const lines = body.split("\n");
  // Balanced braces
  let depth = 0;
  let firstBadLine = -1;
  for (let i = 0; i < lines.length; i++) {
    const clean = lines[i].replace(/\\[{}]/g, "").replace(/%.*$/, "");
    for (const ch of clean) {
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth < 0 && firstBadLine < 0) firstBadLine = i + 1;
      }
    }
  }
  if (depth !== 0) {
    issues.push({
      severity: "error",
      line: firstBadLine > 0 ? firstBadLine : lines.length,
      message: `Unbalanced braces (net ${depth > 0 ? "+" : ""}${depth}).`,
    });
  }
  // \begin / \end pairs
  const stack: { env: string; line: number }[] = [];
  lines.forEach((l, i) => {
    const beginRe = /\\begin\{([^}]+)\}/g;
    const endRe = /\\end\{([^}]+)\}/g;
    let bm: RegExpExecArray | null;
    while ((bm = beginRe.exec(l)) !== null) stack.push({ env: bm[1], line: i + 1 });
    let em: RegExpExecArray | null;
    while ((em = endRe.exec(l)) !== null) {
      const top = stack.pop();
      if (!top || top.env !== em[1]) {
        issues.push({
          severity: "error",
          line: i + 1,
          message: `\\end{${em[1]}} without matching \\begin (top of stack: ${top?.env ?? "empty"}).`,
        });
      }
    }
  });
  for (const s of stack) {
    issues.push({ severity: "error", line: s.line, message: `\\begin{${s.env}} never closed.` });
  }
  // Unescaped specials outside math and commands
  lines.forEach((l, i) => {
    // Strip commands, args, math
    const stripped = l
      .replace(/\\[a-zA-Z@]+\*?(\[[^\]]*\])?(\{[^{}]*\})*/g, "")
      .replace(/\$[^$]*\$/g, "")
      .replace(/%.*$/, "");
    if (/(?<!\\)&/.test(stripped)) issues.push({ severity: "warn", line: i + 1, message: "Unescaped '&' (use \\&)." });
    if (/(?<!\\)_/.test(stripped)) issues.push({ severity: "warn", line: i + 1, message: "Unescaped '_' (use \\_)." });
    if (/(?<!\\)#/.test(stripped)) issues.push({ severity: "warn", line: i + 1, message: "Unescaped '#' (use \\#)." });
  });
  return issues;
}

// ---------- Executor ----------

export async function runTool(
  supabase: SB,
  projectId: string,
  name: string,
  input: any,
  toolUseId?: string,
): Promise<{ content: string; is_error?: boolean }> {
  try {
    switch (name) {
      case "get_project": {
        const { data, error } = await supabase.from("projects").select("*").eq("id", projectId).maybeSingle();
        if (error) throw error;
        return { content: JSON.stringify(data) };
      }
      case "set_profile_data": {
        const { data: cur } = await supabase.from("projects").select("profile_data").eq("id", projectId).maybeSingle();
        const merged = { ...((cur?.profile_data as object) ?? {}), ...(input.patch ?? {}) };
        const { error } = await supabase.from("projects").update({ profile_data: merged }).eq("id", projectId);
        if (error) throw error;
        return { content: JSON.stringify({ ok: true, profile_data: merged }) };
      }

      case "read_strategy": {
        const { data, error } = await supabase
          .from("projects")
          .select("strategy_md")
          .eq("id", projectId)
          .maybeSingle();
        if (error) throw error;
        return { content: JSON.stringify({ content: (data as any)?.strategy_md ?? "" }) };
      }
      case "write_strategy": {
        const content = String(input.content ?? "");
        const { error } = await supabase
          .from("projects")
          .update({ strategy_md: content } as any)
          .eq("id", projectId);
        if (error) throw error;
        return { content: JSON.stringify({ ok: true, length: content.length }) };
      }
      case "append_strategy": {
        const addition = String(input.content ?? "");
        const { data: cur } = await supabase
          .from("projects")
          .select("strategy_md")
          .eq("id", projectId)
          .maybeSingle();
        const prev = ((cur as any)?.strategy_md ?? "") as string;
        const next = prev.length ? `${prev.replace(/\s+$/, "")}\n\n${addition}` : addition;
        const { error } = await supabase
          .from("projects")
          .update({ strategy_md: next } as any)
          .eq("id", projectId);
        if (error) throw error;
        return { content: JSON.stringify({ ok: true, length: next.length }) };
      }
      case "patch_strategy": {
        const section = String((input as any)?.section ?? "");
        const body = String((input as any)?.content ?? "");
        const allowed = ["Plan", "Criteria", "Recommenders", "To do", "Notes"] as const;
        if (!(allowed as readonly string[]).includes(section)) {
          return { content: `section must be one of ${allowed.join(", ")}`, is_error: true };
        }
        const { data: cur } = await supabase
          .from("projects")
          .select("strategy_md")
          .eq("id", projectId)
          .maybeSingle();
        const prev = ((cur as any)?.strategy_md ?? "") as string;
        const next = patchStrategyMd(prev, section, body);
        const { error } = await supabase
          .from("projects")
          .update({ strategy_md: next } as any)
          .eq("id", projectId);
        if (error) throw error;
        return { content: JSON.stringify({ ok: true, section, length: next.length }) };
      }



      case "list_sections": {
        const { data, error } = await supabase
          .from("sections")
          .select("id, section_key, title, order_index")
          .eq("project_id", projectId)
          .order("order_index");
        if (error) throw error;
        return { content: JSON.stringify(data ?? []) };
      }

      case "get_document_outline": {
        const { data, error } = await supabase
          .from("sections")
          .select("section_key, title, order_index, tex_body")
          .eq("project_id", projectId)
          .order("order_index");
        if (error) throw error;
        const outline = (data ?? []).map((s: any) => {
          const body = s.tex_body ?? "";
          const words = body.trim() ? body.trim().split(/\s+/).length : 0;
          return {
            section_key: s.section_key,
            title: s.title,
            order_index: s.order_index,
            lines: body.split("\n").length,
            words,
            preview: body.slice(0, 200),
          };
        });
        return { content: JSON.stringify(outline) };
      }

      case "get_section": {
        const { data, error } = await supabase
          .from("sections")
          .select("*")
          .eq("project_id", projectId)
          .eq("section_key", input.section_key)
          .maybeSingle();
        if (error) throw error;
        if (!data) return { content: `Section '${input.section_key}' not found.`, is_error: true };
        return { content: JSON.stringify(data) };
      }

      case "get_sections_bulk": {
        const keys: string[] = input.section_keys ?? [];
        if (!keys.length) return { content: "section_keys required.", is_error: true };
        const { data, error } = await supabase
          .from("sections")
          .select("section_key, title, order_index, tex_body")
          .eq("project_id", projectId)
          .in("section_key", keys);
        if (error) throw error;
        return { content: JSON.stringify(data ?? []) };
      }

      case "search_document": {
        const { data, error } = await supabase
          .from("sections")
          .select("section_key, title, tex_body")
          .eq("project_id", projectId)
          .order("order_index");
        if (error) throw error;
        const re = toRegex(input.query, !!input.is_regex, !!input.case_sensitive, true);
        const max = input.max_matches ?? 100;
        const out: any[] = [];
        for (const s of data ?? []) {
          const body = (s as any).tex_body ?? "";
          const matches = findMatches(body, new RegExp(re.source, re.flags), max - out.length);
          for (const m of matches) {
            out.push({ section_key: (s as any).section_key, title: (s as any).title, ...m });
            if (out.length >= max) break;
          }
          if (out.length >= max) break;
        }
        return { content: JSON.stringify({ matches: out, truncated: out.length >= max }) };
      }

      case "upsert_section": {
        const orderIndex =
          typeof input.order_index === "number"
            ? input.order_index
            : await nextSectionOrder(supabase, projectId);
        const { data: existing } = await supabase
          .from("sections")
          .select("id")
          .eq("project_id", projectId)
          .eq("section_key", input.section_key)
          .maybeSingle();
        if (existing) {
          const { error } = await supabase
            .from("sections")
            .update({
              title: input.title,
              tex_body: input.tex_body,
              order_index: orderIndex,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);
          if (error) throw error;
          return { content: JSON.stringify({ ok: true, id: existing.id, updated: true }) };
        }
        const { data, error } = await supabase
          .from("sections")
          .insert({
            project_id: projectId,
            section_key: input.section_key,
            title: input.title,
            tex_body: input.tex_body,
            order_index: orderIndex,
          })
          .select("id")
          .single();
        if (error) throw error;
        return { content: JSON.stringify({ ok: true, id: data.id, created: true }) };
      }

      case "replace_in_section": {
        const { data: sec, error } = await supabase
          .from("sections")
          .select("id, tex_body")
          .eq("project_id", projectId)
          .eq("section_key", input.section_key)
          .maybeSingle();
        if (error) throw error;
        if (!sec) return { content: `Section '${input.section_key}' not found.`, is_error: true };
        const body: string = (sec as any).tex_body ?? "";
        const occurrence = input.occurrence ?? "all";
        const re = toRegex(input.find, !!input.is_regex, true, occurrence === "all");
        const matches = body.match(re) ?? [];
        const count = matches.length;
        if (typeof input.expected_count === "number" && count !== input.expected_count) {
          return {
            content: JSON.stringify({
              ok: false,
              reason: "expected_count mismatch",
              found: count,
              expected: input.expected_count,
            }),
            is_error: true,
          };
        }
        if (count === 0) return { content: JSON.stringify({ ok: false, reason: "no match", found: 0 }), is_error: true };
        const nextBody = body.replace(re, input.replace);
        const { error: uErr } = await supabase
          .from("sections")
          .update({ tex_body: nextBody, updated_at: new Date().toISOString() })
          .eq("id", (sec as any).id);
        if (uErr) throw uErr;
        return {
          content: JSON.stringify({
            ok: true,
            replaced: count,
            preview: nextBody.slice(0, 400),
          }),
        };
      }

      case "insert_in_section": {
        const { data: sec, error } = await supabase
          .from("sections")
          .select("id, tex_body")
          .eq("project_id", projectId)
          .eq("section_key", input.section_key)
          .maybeSingle();
        if (error) throw error;
        if (!sec) return { content: `Section '${input.section_key}' not found.`, is_error: true };
        const body: string = (sec as any).tex_body ?? "";
        const pos = input.position;
        const text: string = input.text;
        let nextBody: string;
        if (pos === "start") nextBody = text + (text.endsWith("\n") ? "" : "\n") + body;
        else if (pos === "end") nextBody = body + (body.endsWith("\n") ? "" : "\n") + text;
        else if (pos && typeof pos === "object" && typeof pos.after_line === "number") {
          const lines = body.split("\n");
          const idx = Math.min(Math.max(pos.after_line, 0), lines.length);
          lines.splice(idx, 0, text);
          nextBody = lines.join("\n");
        } else if (pos && typeof pos === "object" && typeof pos.before_pattern === "string") {
          const re = toRegex(pos.before_pattern, true, true, false);
          const m = body.match(re);
          if (!m || m.index === undefined) {
            return { content: JSON.stringify({ ok: false, reason: "pattern not found" }), is_error: true };
          }
          nextBody = body.slice(0, m.index) + text + (text.endsWith("\n") ? "" : "\n") + body.slice(m.index);
        } else return { content: "invalid position", is_error: true };
        const { error: uErr } = await supabase
          .from("sections")
          .update({ tex_body: nextBody, updated_at: new Date().toISOString() })
          .eq("id", (sec as any).id);
        if (uErr) throw uErr;
        return { content: JSON.stringify({ ok: true, new_length: nextBody.length }) };
      }

      case "apply_patch": {
        const { data: sec, error } = await supabase
          .from("sections")
          .select("id, tex_body")
          .eq("project_id", projectId)
          .eq("section_key", input.section_key)
          .maybeSingle();
        if (error) throw error;
        if (!sec) return { content: `Section '${input.section_key}' not found.`, is_error: true };
        let body: string = (sec as any).tex_body ?? "";
        const applied: any[] = [];
        for (let i = 0; i < (input.hunks ?? []).length; i++) {
          const h = input.hunks[i];
          const re = toRegex(h.find, !!h.is_regex, true, false);
          if (!re.test(body)) {
            return {
              content: JSON.stringify({ ok: false, failed_hunk: i, reason: "no match", applied }),
              is_error: true,
            };
          }
          body = body.replace(re, h.replace);
          applied.push({ hunk: i, ok: true });
        }
        const { error: uErr } = await supabase
          .from("sections")
          .update({ tex_body: body, updated_at: new Date().toISOString() })
          .eq("id", (sec as any).id);
        if (uErr) throw uErr;
        return { content: JSON.stringify({ ok: true, hunks: applied.length }) };
      }

      case "delete_section": {
        const { error } = await supabase
          .from("sections")
          .delete()
          .eq("project_id", projectId)
          .eq("section_key", input.section_key);
        if (error) throw error;
        return { content: JSON.stringify({ ok: true }) };
      }

      case "reorder_sections": {
        const keys: string[] = input.ordered_keys ?? [];
        if (!keys.length) return { content: "ordered_keys required", is_error: true };
        const results: any[] = [];
        for (let i = 0; i < keys.length; i++) {
          const { error } = await supabase
            .from("sections")
            .update({ order_index: (i + 1) * 10, updated_at: new Date().toISOString() })
            .eq("project_id", projectId)
            .eq("section_key", keys[i]);
          if (error) throw error;
          results.push({ section_key: keys[i], order_index: (i + 1) * 10 });
        }
        return { content: JSON.stringify({ ok: true, sections: results }) };
      }

      case "get_rendered_latex": {
        const bundle = await loadBundle(supabase, projectId);
        const { files, mainFile } = buildTemplate(bundle, "compile");
        // Inline all \input{...} the way the compiler will resolve them.
        const inline = (src: string, seen = new Set<string>()): string =>
          src.replace(/\\input\{([^}]+)\}/g, (_, p) => {
            const path = p.endsWith(".tex") ? p : `${p}.tex`;
            if (seen.has(path) || !files[path]) return `% missing: ${path}`;
            seen.add(path);
            return inline(files[path], seen);
          });
        const rendered = inline(files[mainFile]);
        const lines = rendered.split("\n");
        let start = 1;
        let end = lines.length;
        if (Array.isArray(input?.line_range) && input.line_range.length === 2) {
          start = Math.max(1, input.line_range[0]);
          end = Math.min(lines.length, input.line_range[1]);
        } else if (typeof input?.around_line === "number") {
          const ctx = input.context ?? 20;
          start = Math.max(1, input.around_line - ctx);
          end = Math.min(lines.length, input.around_line + ctx);
        }
        const slice = lines
          .slice(start - 1, end)
          .map((l, i) => `${String(start + i).padStart(5, " ")}  ${l}`)
          .join("\n");
        return {
          content: JSON.stringify({
            total_lines: lines.length,
            start,
            end,
            content: slice,
          }),
        };
      }

      case "get_last_compile": {
        const { data, error } = await supabase
          .from("compile_requests")
          .select("id, status, reason, requested_at, completed_at, pdf_path, log, error_lines")
          .eq("project_id", projectId)
          .order("requested_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        if (!data) return { content: "No compile runs yet." };
        const log = (data.log ?? "").slice(-2000);
        return {
          content: JSON.stringify({
            id: data.id,
            status: data.status,
            reason: data.reason,
            requested_at: data.requested_at,
            completed_at: data.completed_at,
            pdf_path: data.pdf_path,
            error_lines: data.error_lines,
            log_tail: log,
          }),
        };
      }

      case "get_compile_history": {
        const limit = Math.min(input?.limit ?? 10, 50);
        const { data, error } = await supabase
          .from("compile_requests")
          .select("id, status, reason, requested_at, completed_at, pdf_path, error_lines")
          .eq("project_id", projectId)
          .order("requested_at", { ascending: false })
          .limit(limit);
        if (error) throw error;
        return { content: JSON.stringify(data ?? []) };
      }

      case "list_exhibits": {
        const { data, error } = await supabase
          .from("exhibits")
          .select("id, label, title, order_index, page_count, tags")
          .eq("project_id", projectId)
          .order("order_index");
        if (error) throw error;
        return { content: JSON.stringify(data ?? []) };
      }

      case "list_exhibit_citations": {
        const [{ data: sections, error: sErr }, { data: exhibits, error: eErr }] = await Promise.all([
          supabase.from("sections").select("section_key, tex_body").eq("project_id", projectId),
          supabase.from("exhibits").select("label").eq("project_id", projectId),
        ]);
        if (sErr) throw sErr;
        if (eErr) throw eErr;
        const defined = new Set((exhibits ?? []).map((e: any) => e.label));
        const usage = new Map<string, { count: number; sections: Set<string> }>();
        for (const s of sections ?? []) {
          const labels = extractCitedLabels((s as any).tex_body ?? "");
          for (const l of labels) {
            let u = usage.get(l);
            if (!u) usage.set(l, (u = { count: 0, sections: new Set() }));
            u.count++;
            u.sections.add((s as any).section_key);
          }
        }
        const used = [...usage.entries()].map(([label, u]) => ({
          label,
          count: u.count,
          sections: [...u.sections],
        }));
        const orphaned = used.filter((u) => !defined.has(u.label)).map((u) => u.label);
        const unused = [...defined].filter((l) => !usage.has(l));
        return { content: JSON.stringify({ used, orphaned, unused }) };
      }

      case "read_exhibit":
      case "read_exhibit_pdf": {
        const { data: ex, error } = await supabase
          .from("exhibits")
          .select("id, label, storage_path, mime_type, page_count, title")
          .eq("project_id", projectId)
          .eq("label", input.label)
          .maybeSingle();
        if (error) throw error;
        if (!ex) return { content: `No exhibit with label '${input.label}'.`, is_error: true };
        const { data: cached } = await supabase
          .from("exhibit_cache")
          .select("extracted_text")
          .eq("exhibit_id", ex.id)
          .maybeSingle();
        let text = cached?.extracted_text ?? null;
        if (!text && ex.storage_path) {
          const { data: file, error: dErr } = await supabase.storage
            .from("exhibits")
            .download(ex.storage_path);
          if (dErr) throw dErr;
          const buf = new Uint8Array(await file.arrayBuffer());
          const mime = (ex as any).mime_type ?? "application/pdf";
          const out = await extractAttachmentText(buf, mime);
          text = out.text;
          await supabase.from("exhibit_cache").upsert({
            exhibit_id: ex.id,
            extracted_text: text,
            updated_at: new Date().toISOString(),
          });
        }
        const full = text ?? "";
        const offset = Math.max(0, input.offset ?? 0);
        const length = Math.max(1, Math.min(input.length ?? 8000, 20000));
        const chunk = full.slice(offset, offset + length);
        const nextOffset = offset + chunk.length;
        return {
          content: JSON.stringify({
            label: ex.label,
            title: (ex as any).title,
            mime_type: (ex as any).mime_type ?? "application/pdf",
            page_count: (ex as any).page_count,
            total_chars: full.length,
            offset,
            length: chunk.length,
            next_offset: nextOffset < full.length ? nextOffset : null,
            text: chunk,
          }),
        };
      }

      case "search_exhibits": {
        const [{ data: exhibits, error: exErr }] = await Promise.all([
          supabase.from("exhibits").select("id, label, title").eq("project_id", projectId),
        ]);
        if (exErr) throw exErr;
        const ids = (exhibits ?? []).map((e: any) => e.id);
        if (!ids.length) return { content: JSON.stringify({ matches: [] }) };
        const { data: caches, error: cErr } = await supabase
          .from("exhibit_cache")
          .select("exhibit_id, extracted_text")
          .in("exhibit_id", ids);
        if (cErr) throw cErr;
        const byId = new Map<string, string>();
        for (const c of caches ?? []) byId.set((c as any).exhibit_id, (c as any).extracted_text ?? "");
        const max = input.max_matches ?? 50;
        const re = toRegex(input.query, !!input.is_regex, !!input.case_sensitive, true);
        const out: any[] = [];
        for (const ex of exhibits ?? []) {
          const text = byId.get((ex as any).id) ?? "";
          if (!text) continue;
          const matches = findMatches(text, new RegExp(re.source, re.flags), max - out.length);
          for (const m of matches) {
            out.push({
              label: (ex as any).label,
              title: (ex as any).title,
              line: m.line,
              snippet: m.snippet,
            });
            if (out.length >= max) break;
          }
          if (out.length >= max) break;
        }
        return {
          content: JSON.stringify({
            matches: out,
            truncated: out.length >= max,
            note: out.length === 0 ? "No matches. Exhibits are only searchable after read_exhibit_pdf has cached their text." : undefined,
          }),
        };
      }

      case "tag_exhibit": {
        const { error } = await supabase
          .from("exhibits")
          .update({ tags: input.tags })
          .eq("project_id", projectId)
          .eq("label", input.label);
        if (error) throw error;
        return { content: JSON.stringify({ ok: true }) };
      }

      case "rename_exhibit": {
        const title = String(input.title ?? "").trim();
        if (!title) return { content: "title is required", is_error: true };
        if (title.length > 200) return { content: "title too long (max 200)", is_error: true };
        const { data, error } = await supabase
          .from("exhibits")
          .update({ title })
          .eq("project_id", projectId)
          .eq("label", input.label)
          .select("id, label, title")
          .maybeSingle();
        if (error) throw error;
        if (!data) return { content: `Exhibit ${input.label} not found.`, is_error: true };
        return { content: JSON.stringify({ ok: true, exhibit: data }) };
      }

      case "list_uploads": {
        const { data, error } = await supabase
          .from("uploads")
          .select("id, kind, title, mime_type, size_bytes, created_at")
          .eq("project_id", projectId);
        if (error) throw error;
        return { content: JSON.stringify(data ?? []) };
      }

      case "get_upload": {
        const { data, error } = await supabase
          .from("uploads")
          .select("*")
          .eq("id", input.id)
          .eq("project_id", projectId)
          .maybeSingle();
        if (error) throw error;
        if (!data) return { content: "Upload not found.", is_error: true };
        const full = (data.extracted_text ?? "") as string;
        const offset = Math.max(0, input.offset ?? 0);
        const length = Math.max(1, Math.min(input.length ?? 8000, 20000));
        const chunk = full.slice(offset, offset + length);
        const nextOffset = offset + chunk.length;
        return {
          content: JSON.stringify({
            id: data.id,
            title: data.title,
            kind: data.kind,
            mime_type: (data as any).mime_type,
            total_chars: full.length,
            offset,
            length: chunk.length,
            next_offset: nextOffset < full.length ? nextOffset : null,
            text: chunk,
          }),
        };
      }

      case "import_upload_as_section": {
        const { data: up, error } = await supabase
          .from("uploads")
          .select("id, title, extracted_text, mime_type")
          .eq("id", input.upload_id)
          .eq("project_id", projectId)
          .maybeSingle();
        if (error) throw error;
        if (!up) return { content: "Upload not found.", is_error: true };
        const text = (up.extracted_text ?? "") as string;
        if (!text.trim())
          return { content: "Upload has no extracted text.", is_error: true };
        const style = (input.style ?? "verbatim") as "verbatim" | "prose";
        if (style === "prose") {
          return {
            content: JSON.stringify({
              ok: true,
              style: "prose",
              instruction:
                "Rewrite the returned text into persuasive LaTeX prose, then call upsert_section with section_key + title.",
              upload_title: up.title,
              text,
            }),
          };
        }
        // verbatim → escape + wrap and upsert
        const escaped = texEscapeMultiline(text);
        const body = `\\begin{quote}\n${escaped}\n\\end{quote}`;
        const orderIndex = await nextSectionOrder(supabase, projectId);
        const { data: existing } = await supabase
          .from("sections")
          .select("id")
          .eq("project_id", projectId)
          .eq("section_key", input.section_key)
          .maybeSingle();
        if (existing) {
          const { error: uErr } = await supabase
            .from("sections")
            .update({
              title: input.title,
              tex_body: body,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);
          if (uErr) throw uErr;
          return { content: JSON.stringify({ ok: true, updated: true, id: existing.id }) };
        }
        const { data: ins, error: iErr } = await supabase
          .from("sections")
          .insert({
            project_id: projectId,
            section_key: input.section_key,
            title: input.title,
            tex_body: body,
            order_index: orderIndex,
          })
          .select("id")
          .single();
        if (iErr) throw iErr;
        return { content: JSON.stringify({ ok: true, created: true, id: ins.id }) };
      }

      case "attach_exhibit_from_upload": {
        const { data: up, error } = await supabase
          .from("uploads")
          .select("id, title, storage_path, mime_type, size_bytes, extracted_text")
          .eq("id", input.upload_id)
          .eq("project_id", projectId)
          .maybeSingle();
        if (error) throw error;
        if (!up || !up.storage_path)
          return { content: "Upload not found or has no file.", is_error: true };

        const { data: file, error: dErr } = await supabase.storage
          .from("uploads")
          .download(up.storage_path);
        if (dErr) throw dErr;
        const bytes = new Uint8Array(await file.arrayBuffer());

        const { allocateNewExhibitSlot } = await import("./exhibit-labels.server");
        const slot = await allocateNewExhibitSlot(supabase, projectId);
        const label = slot.label;
        const nextIdx = slot.order_index;
        const mime = (up as any).mime_type ?? "application/pdf";
        const ext =
          mime === "application/pdf"
            ? ".pdf"
            : mime.includes("wordprocessingml")
              ? ".docx"
              : mime === "text/markdown"
                ? ".md"
                : mime === "text/plain"
                  ? ".txt"
                  : "";
        const path = `${projectId}/${label}${ext}`;
        const { error: upErr } = await supabase.storage
          .from("exhibits")
          .upload(path, bytes, { contentType: mime, upsert: true });
        if (upErr) throw upErr;

        const text = ((up as any).extracted_text ?? "") as string;
        const pageCount = mime === "application/pdf"
          ? null
          : Math.max(1, Math.ceil((text.trim().split(/\s+/).length || 1) / 450));
        const { data: ex, error: eErr } = await supabase
          .from("exhibits")
          .insert({
            project_id: projectId,
            label,
            title: input.title ?? up.title,
            order_index: nextIdx,
            storage_path: path,
            original_storage_path: path,
            original_page_count: pageCount,
            size_bytes: (up as any).size_bytes,
            page_count: pageCount,
            mime_type: mime,
            tags: input.tags ?? undefined,
          })
          .select("id, label, title, mime_type")
          .single();
        if (eErr) throw eErr;
        if (text) {
          await supabase.from("exhibit_cache").upsert({
            exhibit_id: ex.id,
            extracted_text: text,
            updated_at: new Date().toISOString(),
          });
        }

        // Autonomous AI review + trim for PDFs.
        let review: any = null;
        if (mime === "application/pdf") {
          try {
            const { reviewAndApply } = await import("./exhibit-review.server");
            const outcome = await reviewAndApply({
              supabase,
              projectId,
              exhibitId: ex.id,
              bytes,
              storagePath: path,
              mimeType: mime,
              exhibitTitle: (input.title ?? up.title) as string,
              source: `upload:${up.title ?? "untitled"}`,
            });
            review = {
              status: outcome.status,
              kept_pages: outcome.kept_pages,
              original_page_count: outcome.original_page_count,
              summary: outcome.recommendation?.summary,
              relevance: outcome.recommendation?.relevance,
              rejected: outcome.status === "rejected",
              note: outcome.note,
            };
          } catch (e) {
            console.error("exhibit-review (agent) failed", e);
          }
        }

        if (review?.rejected) {
          return {
            content: `Exhibit ${ex.label} was captured, but the AI review flagged it as irrelevant to this petition: ${review.summary ?? review.note ?? "no substantive evidence"}. Consider deleting or replacing it with a better source.`,
            is_error: true,
          };
        }
        return { content: JSON.stringify({ ok: true, exhibit: ex, review }) };
      }


      case "capture_url_as_exhibit": {
        const { captureUrlToExhibit } = await import("./webcapture.server");
        try {
          const result = await captureUrlToExhibit(
            supabase,
            projectId,
            String(input.url),
            input.title ? String(input.title) : undefined,
            { agentIntent: input.title ? `Captured as: ${String(input.title)}` : undefined },
          );
          if (result.review?.rejected) {
            return {
              content: `Captured ${result.exhibit.label} from ${result.source_url}, but the AI review flagged it as irrelevant to this petition: ${result.review.summary ?? result.review.note ?? "no substantive evidence"}. Try a different source URL that shows the actual evidence.`,
              is_error: true,
            };
          }
          return { content: JSON.stringify(result) };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return { content: `capture_url_as_exhibit failed: ${msg}`, is_error: true };
        }
      }



      case "validate_latex": {
        const { data, error } = await supabase
          .from("sections")
          .select("section_key, tex_body")
          .eq("project_id", projectId)
          .order("order_index");
        if (error) throw error;
        const scoped = input?.section_key
          ? (data ?? []).filter((s: any) => s.section_key === input.section_key)
          : data ?? [];
        const { data: exhibits } = await supabase.from("exhibits").select("label").eq("project_id", projectId);
        const defined = new Set((exhibits ?? []).map((e: any) => e.label));
        const issues: any[] = [];
        for (const s of scoped) {
          const body = (s as any).tex_body ?? "";
          for (const iss of staticValidate(body)) issues.push({ section_key: (s as any).section_key, ...iss });
          for (const label of extractCitedLabels(body)) {
            if (!defined.has(label)) {
              issues.push({
                section_key: (s as any).section_key,
                severity: "error",
                line: 0,
                message: `Undefined exhibit label '${label}'.`,
              });
            }
          }
        }
        return { content: JSON.stringify({ ok: issues.every((i) => i.severity !== "error"), issues }) };
      }

      case "list_letters": {
        const { data, error } = await supabase
          .from("letters")
          .select("id, recommender_name, recommender_email, recommender_title, recommender_org, relationship, status, subject, updated_at, signed_at, exhibit_id")
          .eq("project_id", projectId)
          .order("created_at");
        if (error) throw error;
        return { content: JSON.stringify(data ?? []) };
      }

      case "read_letter": {
        const letterId = String(input.letter_id ?? "");
        if (!letterId) return { content: "letter_id required", is_error: true };
        const { data: letter, error } = await supabase
          .from("letters")
          .select("*")
          .eq("id", letterId)
          .eq("project_id", projectId)
          .maybeSingle();
        if (error) throw error;
        if (!letter) return { content: "letter not found", is_error: true };
        const { data: events } = await supabase
          .from("letter_events")
          .select("type, actor, payload, created_at")
          .eq("letter_id", letterId)
          .order("created_at", { ascending: false })
          .limit(20);
        return { content: JSON.stringify({ letter, events: events ?? [] }) };
      }

      case "create_letter": {
        const { data, error } = await supabase
          .from("letters")
          .insert({
            project_id: projectId,
            recommender_name: input.recommender_name ?? "",
            recommender_email: input.recommender_email ?? "",
            recommender_title: input.recommender_title ?? "",
            recommender_org: input.recommender_org ?? "",
            relationship: input.relationship ?? "",
            notes: input.notes ?? "",
            subject: "",
            body_md: "",
            status: "draft",
          })
          .select("id")
          .single();
        if (error) throw error;
        return { content: JSON.stringify({ ok: true, letter_id: data.id }) };
      }

      case "update_letter": {
        const letterId = String(input.letter_id ?? "");
        if (!letterId) return { content: "letter_id required", is_error: true };
        const { data: cur } = await supabase
          .from("letters")
          .select("status, body_md")
          .eq("id", letterId)
          .eq("project_id", projectId)
          .maybeSingle();
        if (!cur) return { content: "letter not found", is_error: true };
        const patch: Record<string, unknown> = {};
        for (const k of [
          "subject",
          "body_md",
          "recommender_name",
          "recommender_email",
          "recommender_title",
          "recommender_org",
          "relationship",
          "notes",
        ]) {
          if (typeof (input as any)[k] === "string") patch[k] = (input as any)[k];
        }
        if (Object.keys(patch).length === 0)
          return { content: "no fields to update", is_error: true };
        const nextStatus =
          cur.status === "signed" || cur.status === "superseded" ? cur.status : "draft";
        patch.status = nextStatus;
        const { error } = await supabase.from("letters").update(patch as any).eq("id", letterId);
        if (error) throw error;
        await supabase.from("letter_events").insert({
          letter_id: letterId,
          type: "drafted" in patch || "body_md" in patch ? "drafted" : "edited",
          actor: "agent",
          payload: { fields: Object.keys(patch) },
        });
        return { content: JSON.stringify({ ok: true }) };
      }

      case "send_letter_for_review": {
        const letterId = String(input.letter_id ?? "");
        if (!letterId) return { content: "letter_id required", is_error: true };
        const { data: cur } = await supabase
          .from("letters")
          .select("body_md, recommender_email")
          .eq("id", letterId)
          .eq("project_id", projectId)
          .maybeSingle();
        if (!cur) return { content: "letter not found", is_error: true };
        if (!cur.body_md?.trim())
          return { content: "cannot send an empty letter", is_error: true };
        if (!cur.recommender_email?.trim())
          return { content: "recommender_email required before sending", is_error: true };
        await supabase
          .from("letter_tokens")
          .update({ revoked_at: new Date().toISOString() })
          .eq("letter_id", letterId)
          .is("revoked_at", null);
        const bytes = new Uint8Array(32);
        crypto.getRandomValues(bytes);
        const token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
        const { error: tErr } = await supabase
          .from("letter_tokens")
          .insert({ letter_id: letterId, token });
        if (tErr) throw tErr;
        await supabase.from("letters").update({ status: "awaiting_review" }).eq("id", letterId);
        await supabase.from("letter_events").insert({
          letter_id: letterId,
          type: "sent",
          actor: "agent",
        });
        const origin = String(input.origin ?? "").replace(/\/+$/, "");
        return {
          content: JSON.stringify({
            ok: true,
            token,
            review_url: origin ? `${origin}/letter/${token}` : `/letter/${token}`,
          }),
        };
      }

      case "request_documents": {
        if (!toolUseId) return { content: "internal: tool_use_id missing", is_error: true };
        const rawItems = Array.isArray(input?.items) ? input.items : [];
        const items = rawItems
          .filter((it: any) => it && typeof it.key === "string" && typeof it.label === "string")
          .slice(0, 20)
          .map((it: any) => ({
            key: String(it.key).slice(0, 60),
            label: String(it.label).slice(0, 160),
            description: it.description ? String(it.description).slice(0, 400) : undefined,
            required: it.required !== false,
          }));
        if (!items.length) return { content: "items required", is_error: true };
        const title = input?.title ? String(input.title).slice(0, 200) : null;
        // Upsert on tool_use_id so retried turns don't duplicate.
        const { error } = await supabase
          .from("document_requests")
          .upsert(
            { project_id: projectId, tool_use_id: toolUseId, title, items },
            { onConflict: "tool_use_id" },
          );
        if (error) throw error;
        return {
          content: JSON.stringify({
            ok: true,
            widget_shown: true,
            items: items.map((i: any) => i.key),
            note: "The user sees a document-upload checklist in the chat. Wait for them to upload — a follow-up user message will list what arrived.",
          }),
        };
      }

      case "navigate_to": {
        const pane = String(input?.pane ?? "");
        const allowed = ["strategy", "exhibits", "sections", "preview"];
        if (!allowed.includes(pane)) {
          return { content: `pane must be one of ${allowed.join(", ")}`, is_error: true };
        }
        return { content: JSON.stringify({ ok: true, pane, note: "Workspace switched for the user." }) };
      }

      case "suggest_next_steps": {
        const raw = Array.isArray((input as any)?.suggestions) ? (input as any).suggestions : [];
        const suggestions = raw
          .map((s: any) => ({
            label: String(s?.label ?? "").slice(0, 80).trim(),
            prompt: String(s?.prompt ?? "").trim(),
          }))
          .filter((s: { label: string; prompt: string }) => s.label && s.prompt)
          .slice(0, 4);
        if (suggestions.length < 2) {
          return { content: "suggest_next_steps needs 2–4 items, each with a label and a prompt.", is_error: true };
        }
        return {
          content: JSON.stringify({
            ok: true,
            shown: suggestions.length,
            note: "Chips are rendered inline in the chat. The user taps one and it is sent as their next message. Do NOT also write an Option-1/Option-2 paragraph in your reply.",
          }),
        };
      }

      default:
        return { content: `Unknown tool '${name}'.`, is_error: true };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { content: `Tool error: ${msg}`, is_error: true };
  }
}

async function nextSectionOrder(supabase: SB, projectId: string): Promise<number> {
  const { data } = await supabase
    .from("sections")
    .select("order_index")
    .eq("project_id", projectId)
    .order("order_index", { ascending: false })
    .limit(1);
  return (data?.[0]?.order_index ?? 0) + 1;
}

// Replace or insert a single H2 section in the strategy markdown.
// - Preserves the leading pre-H2 case-theory paragraph.
// - Keeps unknown H2s (from older docs) at the end so no data is lost.
// - Rebuilds known sections in canonical order.
const STRATEGY_CANONICAL = ["Plan", "Criteria", "Recommenders", "To do", "Notes"] as const;

export function patchStrategyMd(prev: string, section: string, body: string): string {
  const src = prev ?? "";
  // Split on H2 headings, keeping headings with their bodies.
  const parts = src.split(/(^## .+$)/m);
  // parts[0] is everything before the first "## " (the intro/theory paragraph, possibly empty).
  const intro = (parts[0] ?? "").replace(/\s+$/, "");
  const sections = new Map<string, string>(); // heading text -> body (without heading line)
  for (let i = 1; i < parts.length; i += 2) {
    const heading = (parts[i] ?? "").replace(/^##\s+/, "").trim();
    const segBody = (parts[i + 1] ?? "").replace(/^\n+/, "").replace(/\s+$/, "");
    if (heading) sections.set(heading, segBody);
  }
  sections.set(section, body.replace(/\s+$/, ""));

  const orderedKnown = STRATEGY_CANONICAL.filter((k) => sections.has(k));
  const extras = Array.from(sections.keys()).filter(
    (k) => !(STRATEGY_CANONICAL as readonly string[]).includes(k),
  );
  const chunks: string[] = [];
  if (intro) chunks.push(intro);
  for (const k of [...orderedKnown, ...extras]) {
    chunks.push(`## ${k}\n${sections.get(k) ?? ""}`.replace(/\s+$/, ""));
  }
  return chunks.join("\n\n") + (chunks.length ? "\n" : "");
}
