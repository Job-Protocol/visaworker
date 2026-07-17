import { Quote, AlertTriangle } from "lucide-react";

const HORRORS = [
  {
    quote: "I paid $11,000 and waited six weeks for a first draft that was basically a template with my name pasted in.",
    source: "Engineer, O-1A",
  },
  {
    quote: "My attorney's paralegal emailed me three times asking for links I had already sent. Exhibit 17 was still Exhibit 17 in one place and 'see attached' in another.",
    source: "Researcher, EB-1A",
  },
  {
    quote: "I spent a whole weekend renumbering citations after adding one new paper. The PDF broke at page 48.",
    source: "Founder, NIW",
  },
];

const TESTIMONIALS = [
  {
    quote: "First real draft the same afternoon. My lawyer reviewed the substance instead of fixing formatting for two days.",
    source: "ML lead, O-1A",
  },
  {
    quote: "Dropped my Google Scholar links, and the agent pulled the citations into every criterion. The exhibit index was already numbered.",
    source: "Scientist, EB-1A",
  },
  {
    quote: "$249 vs. the $9K retainer I was quoted. I used the difference to hire counsel to actually review the filing.",
    source: "Designer, O-1A",
  },
];

export function LandingTestimonialsSection() {
  return (
    <section className="relative z-10 overflow-hidden bg-navy py-24 text-paper md:py-32">
      {/* Subtle stars on dark */}
      <div className="pointer-events-none absolute inset-0 bg-stars opacity-30" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-crimson via-paper to-crimson" />

      <div className="relative mx-auto max-w-[1400px] px-6 md:px-10">
        <div className="mb-14 grid gap-10 md:grid-cols-[1fr_1.3fr] md:items-end md:mb-16">
          <div>
            <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.28em] text-gold">
              <span className="h-px w-8 bg-gold" />
              <span>04</span>
            </div>

            <h2 className="mt-5 font-serif text-3xl leading-[1.05] text-paper sm:text-4xl md:text-5xl">
              The horror stories are real. <span className="italic text-crimson">So is the relief.</span>
            </h2>
          </div>
          <p className="text-[15px] leading-relaxed text-paper/70 md:text-lg">
            Immigration petition drafting is notorious for ballooning costs, lost links, and weekends spent renumbering. We don't hide that — we built the alternative.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {HORRORS.map((h, i) => (
            <div
              key={i}
              className="relative border border-paper/10 bg-paper/5 p-6 backdrop-blur-sm md:p-8"
            >
              <div className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-crimson">
                <AlertTriangle className="h-3.5 w-3.5" />
                The usual nightmare
              </div>
              <blockquote className="font-serif text-lg italic leading-snug text-paper/90 md:text-xl">
                "{h.quote}"
              </blockquote>
              <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-paper/50">
                — {h.source}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <div
              key={i}
              className="relative border border-gold/30 bg-paper p-6 text-ink shadow-[8px_8px_0_0_var(--crimson)] md:p-8"
            >
              <Quote className="absolute right-5 top-5 h-8 w-8 text-gold/40" />
              <div className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-navy">
                <span className="h-px w-6 bg-gold" />
                With visaworker.ai
              </div>
              <blockquote className="font-serif text-lg leading-snug text-ink md:text-xl">
                "{t.quote}"
              </blockquote>
              <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-ink/50">
                — {t.source}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-12 text-center text-sm text-paper/50">
          Testimonials are representative of user feedback. Outcomes depend on individual cases and USCIS review.
        </p>
      </div>
    </section>
  );
}
