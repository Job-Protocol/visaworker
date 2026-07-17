// Canonical starter outlines for supported visa types.
// Each section carries a `body` — LaTeX with % TODO comments and pre-wired
// macros (e.g. \criterion{...}) — so the compiled PDF never shows italic
// placeholder text. `prompt` remains for UI hints only.

export type VisaType = "EB-1A" | "O-1A" | "NIW";

export type TemplateSection = {
  key: string;
  title: string;
  prompt: string;      // shown as UI hint / comment
  body?: string;       // LaTeX skeleton; falls back to a % TODO comment
};

export type PetitionTemplate = {
  visaType: VisaType;
  label: string;
  citation: string;
  sections: TemplateSection[];
  exhibitPlaceholders: number;
};

// Regulatory quotes used inside \criterion{...}
const REG = {
  EB1A_PRIZES: "Documentation of the alien's receipt of lesser nationally or internationally recognized prizes or awards for excellence in the field of endeavor.",
  EB1A_MEMBERSHIP: "Documentation of the alien's membership in associations in the field for which classification is sought, which require outstanding achievements of their members, as judged by recognized national or international experts in their disciplines or fields.",
  EB1A_PRESS: "Published material about the alien in professional or major trade publications or other major media, relating to the alien's work in the field for which classification is sought.",
  EB1A_JUDGING: "Evidence of the alien's participation, either individually or on a panel, as a judge of the work of others in the same or an allied field of specification for which classification is sought.",
  EB1A_CONTRIB: "Evidence of the alien's original scientific, scholarly, artistic, athletic, or business-related contributions of major significance in the field.",
  EB1A_AUTHORSHIP: "Evidence of the alien's authorship of scholarly articles in the field, in professional or major trade publications or other major media.",
  EB1A_EXHIBITS: "Evidence of the display of the alien's work in the field at artistic exhibitions or showcases.",
  EB1A_LEADING: "Evidence that the alien has performed in a leading or critical role for organizations or establishments that have a distinguished reputation.",
  EB1A_SALARY: "Evidence that the alien has commanded a high salary or other significantly high remuneration for services, in relation to others in the field.",
  EB1A_COMMERCIAL: "Evidence of commercial successes in the performing arts, as shown by box office receipts or record, cassette, compact disk, or video sales.",

  DHANASAR_1: "The proposed endeavor has both substantial merit and national importance.",
  DHANASAR_2: "The alien is well positioned to advance the proposed endeavor.",
  DHANASAR_3: "On balance, it would be beneficial to the United States to waive the requirements of a job offer and thus of a labor certification.",
};

// Convenience: build a criterion section body.
function critBody(n: number, regcite: string, rulequote: string, hint: string): string {
  return `% TODO(${hint})
\\criterion{${n}}{${regcite}}{${rulequote}}

% TODO: Opening paragraph — identify the qualifying evidence and preview the argument.

% TODO: Evidence walk-through — describe each supporting exhibit in turn, using
%       \\citeexhibit{label} on first mention and \\exhibitref{label} thereafter.

% TODO: Closing paragraph — tie the evidence back to the regulatory standard.
`;
}

function narrativeBody(hint: string): string {
  return `% TODO(${hint})

% TODO: Opening paragraph.

% TODO: Body — 2 to 4 substantive paragraphs. Use \\citeexhibit{label} on first
%       mention of each exhibit and \\exhibitref{label} thereafter.

% TODO: Closing paragraph.
`;
}

const EB1A: PetitionTemplate = {
  visaType: "EB-1A",
  label: "EB-1A — Alien of Extraordinary Ability",
  citation: "8 CFR §204.5(h)(3)",
  exhibitPlaceholders: 20,
  sections: [
    { key: "introduction", title: "Introduction and Statement of Extraordinary Ability",
      prompt: "Who the beneficiary is, the field, and why the petition satisfies the extraordinary-ability standard under Kazarian.",
      body: narrativeBody("Introduction — frame the case and preview the Kazarian two-step analysis.") },
    { key: "background", title: "Beneficiary Background and Field of Endeavor",
      prompt: "Educational history, career trajectory, and a concise description of the field.",
      body: narrativeBody("Background — education, career, and description of the field of endeavor.") },
    { key: "crit_prizes", title: "Nationally or Internationally Recognized Prizes",
      prompt: "Each qualifying award, its selection criteria, and its national/international recognition.",
      body: critBody(1, "8 CFR §204.5(h)(3)(i)", REG.EB1A_PRIZES, "Awards — enumerate qualifying prizes and their selection criteria.") },
    { key: "crit_membership", title: "Membership in Associations Requiring Outstanding Achievement",
      prompt: "Association identity, admission criteria, and expert-judged assessment.",
      body: critBody(2, "8 CFR §204.5(h)(3)(ii)", REG.EB1A_MEMBERSHIP, "Memberships — identify the association and its expert-judged admission bar.") },
    { key: "crit_press", title: "Published Material About the Beneficiary",
      prompt: "Each article/segment, publication standing, and how coverage is about the beneficiary and their work.",
      body: critBody(3, "8 CFR §204.5(h)(3)(iii)", REG.EB1A_PRESS, "Press — publications about the beneficiary in major media.") },
    { key: "crit_judging", title: "Judging the Work of Others",
      prompt: "Each judging instance, requesting body, and the field it covers.",
      body: critBody(4, "8 CFR §204.5(h)(3)(iv)", REG.EB1A_JUDGING, "Judging — panels, peer review, competitions.") },
    { key: "crit_contrib", title: "Original Contributions of Major Significance",
      prompt: "Each original contribution and independent corroboration (citations, adoption, expert letters).",
      body: critBody(5, "8 CFR §204.5(h)(3)(v)", REG.EB1A_CONTRIB, "Contributions — impact, adoption, and independent corroboration.") },
    { key: "crit_authorship", title: "Authorship of Scholarly Articles",
      prompt: "Scholarly articles, venues, and their standing; include citation counts if available.",
      body: critBody(6, "8 CFR §204.5(h)(3)(vi)", REG.EB1A_AUTHORSHIP, "Authorship — scholarly articles and their standing.") },
    { key: "crit_exhibits", title: "Display of Work at Artistic Exhibitions",
      prompt: "Exhibitions/showcases, curating body, and their standing.",
      body: critBody(7, "8 CFR §204.5(h)(3)(vii)", REG.EB1A_EXHIBITS, "Exhibitions — showcases and their curating bodies.") },
    { key: "crit_leading", title: "Leading or Critical Role for Distinguished Organizations",
      prompt: "Organization identity, distinguished reputation, and beneficiary's leading/critical role.",
      body: critBody(8, "8 CFR §204.5(h)(3)(viii)", REG.EB1A_LEADING, "Leading role — establish distinguished org and critical position.") },
    { key: "crit_salary", title: "High Salary or Remuneration",
      prompt: "Comparative salary data (BLS, industry surveys) and how remuneration is high relative to peers.",
      body: critBody(9, "8 CFR §204.5(h)(3)(ix)", REG.EB1A_SALARY, "Salary — comparative data showing high remuneration.") },
    { key: "crit_commercial", title: "Commercial Success in the Performing Arts",
      prompt: "Box office receipts, sales figures, or streaming metrics evidencing commercial success.",
      body: critBody(10, "8 CFR §204.5(h)(3)(x)", REG.EB1A_COMMERCIAL, "Commercial success — box office, sales, streaming metrics.") },
    { key: "final_merits", title: "Final Merits Determination",
      prompt: "Weigh the totality of the evidence — sustained national or international acclaim, at the very top of the field.",
      body: narrativeBody("Final merits — Kazarian step two; sustained acclaim and top-of-field standing.") },
    { key: "conclusion", title: "Conclusion and Requested Relief",
      prompt: "Summarize eligibility and request approval of the I-140 petition.",
      body: narrativeBody("Conclusion — summarize and request approval of the I-140.") },
    { key: "exhibit_index", title: "Exhibit Index",
      prompt: "Numbered list of exhibits filed in support of this petition.",
      body: "% Auto-generated from the exhibits table at compile time.\n" },
  ],
};

const O1A: PetitionTemplate = {
  visaType: "O-1A",
  label: "O-1A — Extraordinary Ability (Nonimmigrant)",
  citation: "8 CFR §214.2(o)(3)(iii)",
  exhibitPlaceholders: 15,
  sections: [
    { key: "introduction", title: "Introduction and Statement of Extraordinary Ability",
      prompt: "Introduce the beneficiary, the petitioner, and the basis for O-1A classification.",
      body: narrativeBody("Introduction — beneficiary, petitioner, and O-1A basis.") },
    { key: "background", title: "Beneficiary Background and Field of Endeavor",
      prompt: "Education, career trajectory, and description of the field.",
      body: narrativeBody("Background — education, career, and description of the field.") },
    { key: "advisory", title: "Advisory Opinion and Peer Consultation",
      prompt: "Attach and reference the peer-group consultation letter or explain why none is available.",
      body: narrativeBody("Advisory opinion — peer-group consultation or explanation of unavailability.") },
    { key: "itinerary", title: "Itinerary of Events and Activities",
      prompt: "Dates, locations, and description of services to be performed during the requested validity period.",
      body: narrativeBody("Itinerary — dates, locations, services to be performed.") },
    { key: "crit_prizes", title: "Nationally or Internationally Recognized Prizes",
      prompt: "Each qualifying award, its selection criteria, and its recognition.",
      body: critBody(1, "8 CFR §214.2(o)(3)(iii)(B)(1)", REG.EB1A_PRIZES, "Awards.") },
    { key: "crit_membership", title: "Membership Requiring Outstanding Achievement",
      prompt: "Association, admission criteria, and expert-judged assessment.",
      body: critBody(2, "8 CFR §214.2(o)(3)(iii)(B)(2)", REG.EB1A_MEMBERSHIP, "Memberships.") },
    { key: "crit_press", title: "Published Material About the Beneficiary",
      prompt: "Coverage about the beneficiary and their work, with publication standing.",
      body: critBody(3, "8 CFR §214.2(o)(3)(iii)(B)(3)", REG.EB1A_PRESS, "Press.") },
    { key: "crit_judging", title: "Judging the Work of Others",
      prompt: "Each judging instance, requesting body, and field.",
      body: critBody(4, "8 CFR §214.2(o)(3)(iii)(B)(4)", REG.EB1A_JUDGING, "Judging.") },
    { key: "crit_contrib", title: "Original Contributions of Major Significance",
      prompt: "Contributions and independent corroboration.",
      body: critBody(5, "8 CFR §214.2(o)(3)(iii)(B)(5)", REG.EB1A_CONTRIB, "Contributions.") },
    { key: "crit_authorship", title: "Authorship of Scholarly Articles",
      prompt: "Scholarly articles and their venues.",
      body: critBody(6, "8 CFR §214.2(o)(3)(iii)(B)(6)", REG.EB1A_AUTHORSHIP, "Authorship.") },
    { key: "crit_leading", title: "Critical Employment for Distinguished Organizations",
      prompt: "Organization's distinguished reputation and beneficiary's critical role.",
      body: critBody(7, "8 CFR §214.2(o)(3)(iii)(B)(7)", REG.EB1A_LEADING, "Critical role.") },
    { key: "crit_salary", title: "High Salary or Remuneration",
      prompt: "Comparative salary data and beneficiary's remuneration.",
      body: critBody(8, "8 CFR §214.2(o)(3)(iii)(B)(8)", REG.EB1A_SALARY, "Salary.") },
    { key: "totality", title: "Totality of the Evidence",
      prompt: "How the record, considered together, establishes extraordinary ability and sustained acclaim.",
      body: narrativeBody("Totality — record considered as a whole.") },
    { key: "conclusion", title: "Conclusion and Requested Relief",
      prompt: "Request approval of the O-1A petition for the requested validity period.",
      body: narrativeBody("Conclusion — request approval for the requested validity period.") },
    { key: "exhibit_index", title: "Exhibit Index",
      prompt: "Numbered list of exhibits filed in support of this petition.",
      body: "% Auto-generated from the exhibits table at compile time.\n" },
  ],
};

const NIW: PetitionTemplate = {
  visaType: "NIW",
  label: "EB-2 NIW — National Interest Waiver",
  citation: "Matter of Dhanasar, 26 I&N Dec. 884 (AAO 2016)",
  exhibitPlaceholders: 15,
  sections: [
    { key: "introduction", title: "Introduction and Dhanasar Framework",
      prompt: "State the proposed endeavor and preview how each Dhanasar prong is satisfied.",
      body: narrativeBody("Introduction — proposed endeavor and Dhanasar overview.") },
    { key: "eb2_qualification", title: "EB-2 Underlying Qualification",
      prompt: "Advanced degree or exceptional ability evidence establishing EB-2 eligibility.",
      body: narrativeBody("EB-2 qualification — advanced degree or exceptional ability.") },
    { key: "prong1", title: "Prong 1 — Substantial Merit and National Importance",
      prompt: "Describe the proposed endeavor and demonstrate its substantial merit and national importance.",
      body: critBody(1, "Matter of Dhanasar, Prong 1", REG.DHANASAR_1, "Prong 1 — merit and national importance.") },
    { key: "prong2", title: "Prong 2 — Well Positioned to Advance the Endeavor",
      prompt: "Education, skills, record of success, plan, and stakeholder interest.",
      body: critBody(2, "Matter of Dhanasar, Prong 2", REG.DHANASAR_2, "Prong 2 — well positioned to advance.") },
    { key: "prong3", title: "Prong 3 — Beneficial to Waive the Labor Certification",
      prompt: "Why, on balance, waiving the job offer and labor certification would benefit the United States.",
      body: critBody(3, "Matter of Dhanasar, Prong 3", REG.DHANASAR_3, "Prong 3 — waiver is on-balance beneficial.") },
    { key: "conclusion", title: "Conclusion and Requested Relief",
      prompt: "Request approval of the I-140 petition with the National Interest Waiver.",
      body: narrativeBody("Conclusion — request approval of the I-140 with NIW.") },
    { key: "exhibit_index", title: "Exhibit Index",
      prompt: "Numbered list of exhibits filed in support of this petition.",
      body: "% Auto-generated from the exhibits table at compile time.\n" },
  ],
};

export const PETITION_TEMPLATES: Record<VisaType, PetitionTemplate> = {
  "EB-1A": EB1A,
  "O-1A": O1A,
  NIW: NIW,
};

export function getTemplate(visaType: string): PetitionTemplate {
  return PETITION_TEMPLATES[(visaType as VisaType)] ?? EB1A;
}
