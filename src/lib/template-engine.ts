// Pure LaTeX template engine for visaworker petitions.
// buildTemplate(input, mode) → { files: {path: source}, mainFile: 'main.tex' }
//
// Style guide (authoritative):
//   - Palatino-style serif via newpxtext/newpxmath, 11.5pt, US Letter,
//     1in margins (1.2in top), 1.15x leading, block paragraphs.
//   - Section headings: eyebrow rule + bold small-caps + gold hairline.
//   - Header (body pages): section name (small caps) left, short tag right.
//   - Footer (body pages): case short name left, page N of M right, thin rule.
//   - Cover: left-aligned formal USCIS filing cover.
//   - Statement of the Case: auto-generated after cover, before TOC.
//   - Exhibit registry (\defineexhibit) determines numbering.
//   - Every included exhibit gets a binder-tab divider page AND a TikZ
//     footer band overlaid on every embedded page.
//   - Reusable environments: \criterion, \pullquote, standardofreview,
//     \statcite. All defined here — never inline formatting in the body.

export type TemplateProject = {
  name: string;
  visa_type: string;
  beneficiary_name?: string | null;
  field?: string | null;
  petitioner?: string | null;
  service_center?: string | null;
  form_number?: string | null;
  short_tag?: string | null;
};

export type TemplateSection = {
  section_key: string;
  title: string;
  tex_body: string;
  order_index: number;
};

export type TemplateExhibit = {
  label: string;
  title: string;
  order_index: number;
  page_count?: number | null;
  mime_type?: string | null;
  extracted_text?: string | null;
  exhibit_type?: string | null;
  exhibit_date?: string | null;
  summary?: string | null;
  supports?: string[] | null;
};

export type TemplateInput = {
  project: TemplateProject;
  sections: TemplateSection[];
  exhibits: TemplateExhibit[];
};

export type TemplateMode = "compile" | "export";

export function texEscape(s: string): string {
  return s
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([{}$&#%_])/g, "\\$1")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}

const EMDASH = "\\textemdash{}";

// -------- doc/classification descriptors --------

function docTitleFor(visa: string): string {
  const v = visa.toUpperCase();
  if (v.includes("EB-1A") || v === "EB1A") return "EB-1A Petition";
  if (v.includes("O-1A") || v === "O1A") return "O-1A Petition";
  if (v.includes("NIW") || v.includes("EB-2")) return "EB-2 NIW Petition";
  return `${visa} Petition`;
}

function classificationFor(visa: string): string {
  const v = visa.toUpperCase();
  if (v.includes("EB-1A") || v === "EB1A") return "Alien of Extraordinary Ability";
  if (v.includes("O-1A") || v === "O1A")
    return "Alien of Extraordinary Ability (Sciences, Business, Education, Athletics)";
  if (v.includes("NIW")) return "National Interest Waiver";
  return visa;
}

function formNumberFor(visa: string): string {
  const v = visa.toUpperCase();
  if (v.includes("O-1")) return "Form I-129";
  return "Form I-140"; // EB-1A, NIW
}

function formTitleFor(visa: string): string {
  const v = visa.toUpperCase();
  if (v.includes("O-1"))
    return "Petition for a Nonimmigrant Worker";
  return "Immigrant Petition for Alien Worker";
}

function shortTagFor(project: TemplateProject): string {
  if (project.short_tag) return project.short_tag;
  const v = project.visa_type.toUpperCase();
  const last = (project.beneficiary_name || "").trim().split(/\s+/).pop() || "";
  return last ? `${v} \\textperiodcentered{} ${last}` : v;
}

// "Last, First" for the footer band.
function beneficiaryLastFirst(name?: string | null): string {
  if (!name) return "";
  const trimmed = name.trim();
  if (!trimmed) return "";
  if (trimmed.includes(",")) return trimmed;
  const parts = trimmed.split(/\s+/);
  if (parts.length < 2) return trimmed;
  const last = parts[parts.length - 1];
  const rest = parts.slice(0, -1).join(" ");
  return `${last}, ${rest}`;
}

// -------- preamble --------

function preamble(project: TemplateProject, includeExhibits: boolean): string {
  const docTitle = texEscape(docTitleFor(project.visa_type));
  const name = texEscape(project.beneficiary_name || "Beneficiary");
  const classification = texEscape(classificationFor(project.visa_type));
  const shortTag = shortTagFor(project); // already escaped-safe (uses macros)
  return `\\documentclass[11pt, letterpaper]{article}

% -- Packages --
\\usepackage[T1]{fontenc}
\\usepackage[utf8]{inputenc}
\\usepackage{newpxtext}
\\usepackage{newpxmath}
\\usepackage[margin=1in, top=1.2in, bottom=1in, headheight=16pt]{geometry}
\\usepackage{setspace}
\\usepackage{parskip}
\\usepackage{titlesec}
\\usepackage{tocloft}
${includeExhibits ? "\\usepackage{pdfpages}\n\\usepackage{graphicx}\n" : ""}\\usepackage{fancyhdr}
\\usepackage[table]{xcolor}
\\usepackage{colortbl}
\\usepackage{booktabs}
\\usepackage{longtable}
\\usepackage{array}
\\usepackage{tabularx}
\\usepackage{enumitem}
\\usepackage{microtype}
\\usepackage{textcomp}
\\usepackage{lastpage}
\\usepackage{soul}
\\usepackage{etoolbox}\\usepackage{ifthen}\\usepackage{calc}\\usepackage{xstring}
\\usepackage{tikz}
\\usetikzlibrary{calc}
\\usepackage[most]{tcolorbox}
\\usepackage[colorlinks=true,breaklinks=true]{hyperref}

% -- Palette --
\\definecolor{vwNavy}{HTML}{0B1B3D}
\\definecolor{vwInk}{HTML}{1A1A1A}
\\definecolor{vwMuted}{HTML}{6B6B70}
\\definecolor{vwRule}{HTML}{C7C4BC}
\\definecolor{vwGold}{HTML}{B08A2E}
\\definecolor{vwSoftBg}{HTML}{F4F1EA}
\\definecolor{vwTabBg}{HTML}{0B1B3D}
\\definecolor{vwWarnBg}{HTML}{FDF6E3}
\\definecolor{vwWarnBorder}{HTML}{B58900}
\\definecolor{vwRowAlt}{HTML}{F8F6F0}

% -- Typography --
\\setstretch{1.15}
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{6pt}
\\sodef\\vwsc{}{0.10em}{0.5em}{0.5em} % small-cap letterspacing helper

% -- Section styling (rule ABOVE, small caps, gold hairline) --
\\titleformat{\\section}%
  {\\normalfont\\Large\\bfseries\\color{vwNavy}}%
  {\\thesection}{0.7em}{}%
  [\\vspace{-4pt}\\hspace*{0pt}\\textcolor{vwGold}{\\rule{2.2em}{1.6pt}}]
\\titleformat{\\subsection}%
  {\\normalfont\\normalsize\\bfseries\\color{vwInk}}%
  {\\thesubsection}{0.6em}{}
\\titleformat{\\subsubsection}%
  {\\normalfont\\normalsize\\itshape\\color{vwInk}}%
  {\\thesubsubsection}{0.5em}{}
\\titlespacing*{\\section}{0pt}{22pt}{10pt}
\\titlespacing*{\\subsection}{0pt}{14pt}{4pt}
\\titlespacing*{\\subsubsection}{0pt}{10pt}{3pt}

% -- Running header / footer --
% Left: current section title in tracked small caps, capped in width so it can't run into the right tag.
% Right: short tag. Footer: case short name left, "Page X of Y" (body-scoped) right, thin rule above.
\\renewcommand{\\sectionmark}[1]{\\markboth{#1}{}}
\\pagestyle{fancy}\\fancyhf{}
\\fancyhead[L]{\\parbox[t]{0.62\\headwidth}{\\raggedright\\footnotesize\\color{vwMuted}\\vwsc{\\leftmark}\\strut}}
\\fancyhead[R]{\\parbox[t]{0.32\\headwidth}{\\raggedleft\\footnotesize\\color{vwMuted}${shortTag}\\strut}}
\\fancyfoot[L]{\\footnotesize\\color{vwMuted}\\itshape ${texEscape(project.name)}}
\\fancyfoot[R]{\\footnotesize\\color{vwMuted}Page \\thepage{} of \\pageref*{vw:endofbody}}
\\renewcommand{\\headrulewidth}{0.4pt}
\\renewcommand{\\footrulewidth}{0.4pt}
\\renewcommand{\\headrule}{\\hbox to\\headwidth{\\color{vwRule}\\leaders\\hrule height 0.4pt\\hfill}}
\\renewcommand{\\footrule}{\\hbox to\\headwidth{\\color{vwRule}\\leaders\\hrule height 0.4pt\\hfill}}

% Clean page style used for cover + exhibit divider pages
\\fancypagestyle{vwCover}{%
  \\fancyhf{}\\renewcommand{\\headrulewidth}{0pt}\\renewcommand{\\footrulewidth}{0pt}%
}
\\fancypagestyle{vwFront}{%
  \\fancyhf{}\\renewcommand{\\headrulewidth}{0pt}\\renewcommand{\\footrulewidth}{0.4pt}%
  \\fancyfoot[R]{\\footnotesize\\color{vwMuted}\\thepage}%
  \\fancyfoot[L]{\\footnotesize\\color{vwMuted}\\itshape ${texEscape(project.name)}}%
}

% -- Links / metadata --
\\hypersetup{
  colorlinks=true,
  linkcolor=black,
  urlcolor=vwNavy,
  citecolor=black,
  pdfauthor={${name}},
  pdftitle={${docTitle} \\textendash{} ${name}}
}

% Common metadata usable in the body / footer band
\\newcommand{\\vwDocTitle}{${docTitle}}
\\newcommand{\\vwName}{${name}}
\\newcommand{\\vwNameLastFirst}{${texEscape(beneficiaryLastFirst(project.beneficiary_name))}}
\\newcommand{\\vwClassification}{${classification}}
\\newcommand{\\vwCaseName}{${texEscape(project.name)}}

% -- Reusable body macros -------------------------------------------------
% \\statcite{8 CFR §204.5(h)(3)} — statutory citation in small caps.
\\newcommand{\\statcite}[1]{{\\vwsc{\\MakeUppercase{#1}}}}

% \\criterion{n}{regcite}{rulequote}
%   Renders a "CRITERION n" eyebrow, then a tinted regulatory quote box.
%   Place immediately after the \\section{...} that opens the criterion.
\\newcommand{\\criterion}[3]{%
  \\par\\vspace{-2pt}%
  {\\footnotesize\\color{vwGold}\\vwsc{CRITERION #1}\\hfill\\color{vwMuted}\\statcite{#2}}\\par
  \\vspace{4pt}%
  \\begin{tcolorbox}[enhanced,boxrule=0pt,frame hidden,colback=vwSoftBg,%
    left=12pt,right=12pt,top=8pt,bottom=8pt,arc=1pt,%
    borderline west={2pt}{0pt}{vwGold}]%
  \\small\\itshape #3%
  \\end{tcolorbox}\\par
  \\vspace{4pt}%
}

% \\pullquote{text}{attrib} — right-floated, small-caps attribution.
\\newcommand{\\pullquote}[2]{%
  \\begin{tcolorbox}[enhanced,boxrule=0pt,frame hidden,colback=white,%
    left=12pt,right=0pt,top=2pt,bottom=2pt,arc=0pt,%
    borderline west={1.2pt}{0pt}{vwNavy}]%
  \\itshape\\large\\color{vwInk} \\enquote{#1}\\par
  \\vspace{4pt}\\normalfont\\footnotesize\\color{vwMuted}\\vwsc{\\MakeUppercase{#2}}%
  \\end{tcolorbox}%
}

% standardofreview environment — narrow band for standard-of-review paragraphs.
\\newtcolorbox{standardofreview}{enhanced,boxrule=0pt,frame hidden,%
  colback=vwSoftBg,left=12pt,right=12pt,top=6pt,bottom=6pt,arc=1pt,%
  borderline west={2pt}{0pt}{vwNavy},fontupper=\\small}
`;
}

// -------- exhibit macros --------

function exhibitSystemTex(): string {
  return `% =====================================================================
% Exhibit system — see exhibit_registry.tex for the definitions.
% Every citation in the body MUST go through one of these macros.
% =====================================================================

\\makeatletter
% \\defineexhibit{label}{num}{title}
\\newcommand{\\defineexhibit}[3]{%
  \\@namedef{ex@#1@num}{#2}%
  \\@namedef{ex@#1@title}{#3}%
}

\\newcommand{\\vw@exNum}[1]{%
  \\ifcsname ex@#1@num\\endcsname\\csname ex@#1@num\\endcsname\\else\\textcolor{red}{\\textbf{??#1}}\\fi}
\\newcommand{\\vw@exTitle}[1]{%
  \\ifcsname ex@#1@title\\endcsname\\csname ex@#1@title\\endcsname\\else\\textcolor{red}{\\textbf{??#1}}\\fi}

% Public citation macros. \\exhibitp uses a real \\pageref to the divider,
% so the "p." number is always the true page in the compiled PDF.
\\newcommand{\\exhibitref}[1]{\\hyperlink{exhibit:#1}{Exhibit~\\vw@exNum{#1}}}
\\newcommand{\\exhibit}[1]{\\exhibitref{#1}}          % legacy alias
\\newcommand{\\exhibitp}[1]{\\hyperlink{exhibit:#1}{Exhibit~\\vw@exNum{#1}, p.~\\pageref*{ex:#1@start}}}
\\newcommand{\\citeexhibit}[1]{\\hyperlink{exhibit:#1}{Exhibit~\\vw@exNum{#1}} (\\emph{\\vw@exTitle{#1}})}
\\newcommand{\\exhibittitle}[1]{\\vw@exTitle{#1}}

% =====================================================================
% Exhibit divider page — editorial, letterhead-style.
% A hairline gold rule at the top, a small-caps eyebrow, a massive navy
% number, a short gold underline, and the exhibit title. A thin gold rule
% at the bottom carries the byline. No heavy right-edge tab — the page
% breathes and the footer aligns naturally with the content column.
% =====================================================================
\\newcommand{\\exhibitcover}[1]{%
  \\clearpage
  \\thispagestyle{vwCover}%
  \\hypertarget{exhibit:#1}{}%
  \\label{ex:#1@start}%
  \\addcontentsline{toc}{section}{Exhibit \\vw@exNum{#1}. \\vw@exTitle{#1}}%
  % Discreet vertical marker in the outer margin: small-caps "EXHIBIT N"
  % rotated 90°, sitting in the right margin so it never crosses text.
  \\begin{tikzpicture}[remember picture,overlay]
    \\node[rotate=-90,anchor=center,text=vwMuted,font=\\footnotesize\\bfseries]
      at ([xshift=-0.45in]current page.east)
      {\\MakeUppercase{Exhibit \\vw@exNum{#1}}};
  \\end{tikzpicture}%
  % Top hairline
  \\noindent{\\color{vwGold}\\rule{\\textwidth}{1pt}}\\par
  \\vspace*{1.6in}%
  % Identity block
  \\noindent\\begin{minipage}{\\textwidth}%
    {\\footnotesize\\color{vwGold}\\vwsc{EXHIBIT}}\\par
    \\vspace{2pt}%
    {\\fontsize{84}{90}\\selectfont\\bfseries\\color{vwNavy}\\vw@exNum{#1}}\\par
    \\vspace{8pt}%
    \\textcolor{vwGold}{\\rule{2.4em}{1.5pt}}\\par
    \\vspace{18pt}%
    {\\LARGE\\bfseries\\color{vwInk}\\vw@exTitle{#1}}\\par
  \\end{minipage}%
  \\vfill
  % Bottom byline rule spans the same content column as everything above.
  {\\color{vwRule}\\rule{\\textwidth}{0.4pt}}\\par
  \\vspace{4pt}%
  \\noindent{\\footnotesize\\color{vwMuted}\\itshape \\vwDocTitle{} \\textbullet{} \\vwName}%
  \\hfill{\\footnotesize\\color{vwMuted}visaworker.ai}%
}


% =====================================================================
% Dynamic footer band overlaid on every included exhibit page.
% Slimmer than before (0.35in) so it doesn't cover legitimate content
% of the source PDF. Just enough to sit under most Bates strips.
% =====================================================================
\\newcommand{\\exhibitfootband}[1]{%
  \\begin{tikzpicture}[remember picture,overlay]
    % Narrow white band along the very bottom
    \\fill[white] (current page.south west) rectangle
      ([yshift=0.35in]current page.south east);
    % Thin rule
    \\draw[vwRule,line width=0.4pt]
      ([xshift=1in,yshift=0.28in]current page.south west) --
      ([xshift=-1in,yshift=0.28in]current page.south east);
    % Left: exhibit identity
    \\node[anchor=south west,text=vwMuted,font=\\footnotesize]
      at ([xshift=1in,yshift=0.10in]current page.south west)
      {Exhibit~\\vw@exNum{#1} \\textbullet{} \\vw@exTitle{#1}};
    % Right: page in petition
    \\node[anchor=south east,text=vwMuted,font=\\footnotesize]
      at ([xshift=-1in,yshift=0.10in]current page.south east)
      {Page \\thepage{}};
  \\end{tikzpicture}%
}

% \\insertexhibit{label} — divider page + embedded document with footer band.
\\newcommand{\\insertexhibit}[1]{%
  \\exhibitcover{#1}%
  \\clearpage
  \\IfFileExists{exhibits/#1.pdf}{%
    % scale=0.94 leaves a small uniform breathing margin around the embedded
    % page so exhibits don't butt against the paper edge (the footer band
    % still sits in the bottom 0.35in).
    \\includepdf[pages=-,scale=0.94,pagecommand={\\thispagestyle{empty}\\exhibitfootband{#1}}]{exhibits/#1.pdf}%

  }{%
    \\IfFileExists{exhibits/#1.png}{%
      \\thispagestyle{empty}\\exhibitfootband{#1}%
      \\begin{center}\\includegraphics[width=\\textwidth,height=0.80\\textheight,keepaspectratio]{exhibits/#1.png}\\end{center}%
    }{%
      \\IfFileExists{exhibits/#1.jpg}{%
        \\thispagestyle{empty}\\exhibitfootband{#1}%
        \\begin{center}\\includegraphics[width=\\textwidth,height=0.80\\textheight,keepaspectratio]{exhibits/#1.jpg}\\end{center}%
      }{%
        \\thispagestyle{fancy}%
        \\begin{tcolorbox}[colback=vwWarnBg,colframe=vwWarnBorder,boxrule=0.6pt,arc=1pt,left=10pt,right=10pt,top=8pt,bottom=8pt]%
          \\textbf{Missing exhibit file:} \\texttt{exhibits/#1.(pdf|png|jpg)}\\par\\smallskip
          {\\footnotesize This exhibit is registered but the underlying document has not been uploaded. Upload it in the workspace and recompile.}%
        \\end{tcolorbox}%
      }%
    }%
  }%
}
\\makeatother
`;
}

// -------- exhibit registry (server-baked numbering) --------

function exhibitRegistryTex(exhibits: TemplateExhibit[]): {
  registry: string;
  labelsInOrder: { label: string; num: number }[];
} {
  const sorted = [...exhibits].sort((a, b) => a.order_index - b.order_index);
  const lines: string[] = [];
  const meta: { label: string; num: number }[] = [];
  sorted.forEach((ex, i) => {
    const num = i + 1;
    const label = sanitizeLabel(ex.label);
    const title = texEscape(ex.title || ex.label);
    lines.push(`\\defineexhibit{${label}}{${num}}{${title}}`);
    meta.push({ label, num });
  });
  return {
    registry: `% Order in this file = exhibit number. Regenerated on every compile.\n${lines.join("\n")}\n`,
    labelsInOrder: meta,
  };
}

function sanitizeLabel(label: string): string {
  return label.replace(/[^a-zA-Z0-9]/g, "");
}

// -------- sections dispatcher --------

function sectionsTex(sections: TemplateSection[]): string {
  const sorted = [...sections].sort((a, b) => a.order_index - b.order_index);
  return sorted.map((s) => `\\input{sections/${slug(s.section_key)}.tex}`).join("\n") + "\n";
}

function exhibitsBundleTex(labels: { label: string }[]): string {
  return labels.map((m) => `\\insertexhibit{${m.label}}`).join("\n") + "\n";
}

function slug(k: string): string {
  return k.replace(/[^a-zA-Z0-9_-]/g, "_");
}

// -------- cover page (formal USCIS filing cover) --------

function coverPage(project: TemplateProject): string {
  const beneficiary = texEscape(project.beneficiary_name || "Beneficiary");
  const petitioner = texEscape(project.petitioner || "Self-Petitioner");
  const classification = texEscape(classificationFor(project.visa_type));
  const field = project.field ? texEscape(project.field) : EMDASH;
  const caseLine = texEscape(project.name);
  const visa = project.visa_type.toUpperCase();
  const formNum = texEscape(project.form_number || formNumberFor(project.visa_type));
  const formTitle = texEscape(formTitleFor(project.visa_type));
  const serviceCenter = texEscape(project.service_center || "USCIS Service Center");
  return `\\begin{titlepage}
\\thispagestyle{empty}
\\begin{tikzpicture}[remember picture,overlay]
  \\fill[vwNavy] (current page.north west) rectangle
    ([yshift=-0.35in]current page.north east);
  \\fill[vwGold] ([yshift=-0.35in]current page.north west) rectangle
    ([yshift=-0.40in]current page.north east);
\\end{tikzpicture}
\\vspace*{0.8in}

\\noindent{\\footnotesize\\color{vwMuted}\\vwsc{FILED WITH}}\\par
{\\normalsize U.S. Citizenship and Immigration Services}\\par
{\\small\\color{vwMuted}${serviceCenter}}\\par

\\vspace{0.6in}
\\noindent\\textcolor{vwGold}{\\rule{2.4em}{2pt}}\\par
\\vspace{0.25in}

\\noindent{\\footnotesize\\color{vwMuted}\\vwsc{PETITION}}\\par
{\\LARGE\\bfseries\\color{vwNavy}${formTitle}}\\par
\\vspace{2pt}
{\\small\\color{vwMuted}${formNum} \\textbullet{} ${texEscape(visa)} \\textbullet{} ${classification}}\\par

\\vspace{0.6in}
\\noindent\\begin{tabularx}{\\textwidth}{@{}l X@{}}
{\\footnotesize\\color{vwMuted}\\vwsc{BENEFICIARY}} & {\\Large\\bfseries\\color{vwInk}${beneficiary}}\\\\[6pt]
\\midrule
{\\footnotesize\\color{vwMuted}\\vwsc{PETITIONER}} & ${petitioner}\\\\[4pt]
{\\footnotesize\\color{vwMuted}\\vwsc{FIELD}}      & ${field}\\\\[4pt]
{\\footnotesize\\color{vwMuted}\\vwsc{MATTER}}     & ${caseLine}\\\\[4pt]
{\\footnotesize\\color{vwMuted}\\vwsc{PREPARED}}   & \\today\\\\
\\end{tabularx}

\\vfill

\\noindent{\\footnotesize\\color{vwMuted}\\itshape Petition and supporting documentation}\\hfill{\\footnotesize\\color{vwMuted}visaworker.ai}
\\end{titlepage}
`;
}

// -------- Statement of the Case --------

function statementOfCase(
  project: TemplateProject,
  sections: TemplateSection[],
  exhibits: TemplateExhibit[],
): string {
  const classification = texEscape(classificationFor(project.visa_type));
  const beneficiary = texEscape(project.beneficiary_name || "the Beneficiary");
  // Detect which criterion sections have substantive bodies (>80 non-comment chars).
  const criteria = sections
    .filter((s) => s.section_key.startsWith("crit_") || s.section_key.startsWith("prong"))
    .filter((s) => stripComments(s.tex_body).trim().length > 80)
    .map((s) => `  \\item ${texEscape(s.title)}`)
    .join("\n");
  const totalPages = exhibits.reduce(
    (acc, ex) => acc + Math.max(1, ex.page_count ?? 1),
    0,
  );
  return `\\clearpage
\\thispagestyle{vwFront}
\\noindent{\\footnotesize\\color{vwGold}\\vwsc{STATEMENT OF THE CASE}}\\par
\\vspace{6pt}
{\\Large\\bfseries\\color{vwNavy}${beneficiary} respectfully petitions for classification as an ${classification}.}\\par
\\vspace{4pt}
\\textcolor{vwGold}{\\rule{2.4em}{2pt}}\\par

\\vspace{18pt}
${
  criteria
    ? `\\noindent{\\footnotesize\\color{vwMuted}\\vwsc{QUALIFYING CRITERIA INVOKED}}\\par
\\begin{itemize}[leftmargin=1.2em,itemsep=2pt,topsep=4pt]
${criteria}
\\end{itemize}
`
    : ""
}
\\vspace{10pt}
\\noindent\\begin{tabularx}{\\textwidth}{@{}l X l X@{}}
\\toprule
{\\footnotesize\\color{vwMuted}\\vwsc{EXHIBITS}} & ${exhibits.length} filed &
{\\footnotesize\\color{vwMuted}\\vwsc{EX. PAGES}} & ${totalPages}\\\\
\\midrule
{\\footnotesize\\color{vwMuted}\\vwsc{PREPARED BY}} & visaworker.ai &
{\\footnotesize\\color{vwMuted}\\vwsc{DATE}} & \\today\\\\
\\bottomrule
\\end{tabularx}
`;
}

function stripComments(tex: string): string {
  return tex
    .split("\n")
    .map((l) => l.replace(/(^|[^\\])%.*$/, "$1"))
    .join("\n");
}

// -------- main.tex assembler --------

function mainTex(
  project: TemplateProject,
  mode: TemplateMode,
  hasExhibits: boolean,
  sections: TemplateSection[],
  exhibits: TemplateExhibit[],
): string {
  const includeExhibits = mode === "export" || hasExhibits;
  return `${preamble(project, includeExhibits)}

\\input{exhibit_system.tex}
\\input{exhibit_registry.tex}

\\begin{document}

${coverPage(project)}

% front-matter
\\pagenumbering{roman}
${statementOfCase(project, sections, exhibits)}

\\clearpage
\\thispagestyle{vwFront}
\\noindent{\\footnotesize\\color{vwGold}\\vwsc{CONTENTS}}\\par
\\vspace{4pt}
\\textcolor{vwGold}{\\rule{2.4em}{2pt}}\\par
\\vspace{10pt}
{\\let\\clearpage\\relax\\renewcommand{\\contentsname}{\\vspace{-2\\baselineskip}}\\tableofcontents}
\\clearpage

% main body
\\pagenumbering{arabic}
\\setcounter{page}{1}
\\input{sections.tex}
% Body-scoped last page marker — footer "Page X of Y" references this,
% so body pages read "Page 4 of 12" instead of counting exhibit pages.
\\label{vw:endofbody}

${
  includeExhibits
    ? `\\clearpage
\\thispagestyle{vwCover}
\\vspace*{2.0in}
\\noindent{\\footnotesize\\color{vwGold}\\vwsc{PART II}}\\par
{\\Huge\\bfseries\\color{vwNavy}Exhibits}\\par
\\vspace{6pt}
\\textcolor{vwGold}{\\rule{3.2em}{2pt}}\\par
\\vspace{10pt}
{\\normalsize\\color{vwMuted}\\itshape Supporting documentation filed with this petition.}
\\addcontentsline{toc}{section}{Exhibits}
\\input{exhibits.tex}
`
    : ""
}\\end{document}
`;
}

// -------- entry point --------

export function buildTemplate(input: TemplateInput, mode: TemplateMode): {
  files: Record<string, string>;
  mainFile: string;
} {
  const hasExhibits = input.exhibits.length > 0;
  const { registry, labelsInOrder } = exhibitRegistryTex(input.exhibits);
  const files: Record<string, string> = {
    "main.tex": mainTex(input.project, mode, hasExhibits, input.sections, input.exhibits),
    "exhibit_system.tex": exhibitSystemTex(),
    "exhibit_registry.tex": registry,
    "sections.tex": sectionsTex(input.sections),
  };
  for (const s of input.sections) {
    const body =
      s.section_key === "exhibit_index"
        ? renderExhibitIndex(input.exhibits)
        : s.tex_body;
    files[`sections/${slug(s.section_key)}.tex`] =
      `\\section{${texEscape(s.title || s.section_key)}}\\label{sec:${slug(s.section_key)}}\n\n${body}\n`;
  }
  if (mode === "export" || hasExhibits) {
    files["exhibits.tex"] = exhibitsBundleTex(labelsInOrder);
  }
  if (mode === "export") {
    files["README.md"] = `# ${input.project.name}\n\nCompile with:\n\n\`\`\`\nlatexmk -pdf main.tex\n\`\`\`\n\nOr, using pdflatex directly (run at least 3 times so TOC, exhibit page numbers, and the "Page X of Y" footer resolve):\n\n\`\`\`\npdflatex main.tex && pdflatex main.tex && pdflatex main.tex\n\`\`\`\n`;
  }
  return { files, mainFile: "main.tex" };
}

// -------- exhibit index (rendered inside a section) --------

function renderExhibitIndex(exhibits: TemplateExhibit[]): string {
  if (exhibits.length === 0) {
    return "\\emph{No exhibits have been attached yet.}";
  }
  const sorted = [...exhibits].sort((a, b) => a.order_index - b.order_index);
  const rows = sorted
    .map((ex, i) => {
      const num = i + 1;
      const cleanLabel = sanitizeLabel(ex.label);
      const title = texEscape(ex.title || ex.label);
      const pages = ex.page_count && ex.page_count > 0 ? String(ex.page_count) : EMDASH;
      return `${num} & \\hyperlink{exhibit:${cleanLabel}}{${title}} & ${pages}\\\\`;
    })
    .join("\n");
  return `\\vspace{0.2em}
{\\rowcolors{2}{white}{vwRowAlt}
\\begin{tabularx}{\\textwidth}{@{}r X r@{}}
\\toprule
{\\footnotesize\\vwsc{TAB}} & {\\footnotesize\\vwsc{TITLE}} & {\\footnotesize\\vwsc{PAGES}}\\\\
\\midrule
${rows}
\\bottomrule
\\end{tabularx}}`;
}
