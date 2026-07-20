import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { RefBanner, LandingReferralSection } from "@/ee";
import { LandingTestimonialsSection } from "@/components/TestimonialsSection";
import { GitHubStarButton, GitHubStarInline } from "@/components/GitHubStarButton";
import { SiteHeader } from "@/components/SiteHeader";
import { YouTubeHoverPlayer } from "@/components/youtube-hover-player";
import { track } from "@/ee";
import statueOfLiberty from "@/assets/statue-of-liberty.jpg";
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  Compass,
  FileCheck2,
  Handshake,
  Link2,
  Minus,
  Sparkles,
  Star,
  Users,
  X,
} from "lucide-react";

/**
 * Premium landing interactions:
 * - Scroll-reveal (staggered) via IntersectionObserver on [data-reveal]
 * - Mouse-tracked spotlight glow on [data-spotlight]
 * - 3D tilt on [data-tilt] cards following cursor
 */
function useLandingInteractions() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Scroll reveal
    const revealEls = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    let revealObserver: IntersectionObserver | null = null;
    if (prefersReduced) {
      revealEls.forEach((el) => el.classList.add("is-in"));
    } else {
      revealObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              (e.target as HTMLElement).classList.add("is-in");
              revealObserver?.unobserve(e.target);
            }
          });
        },
        { threshold: 0.15, rootMargin: "0px 0px -60px 0px" },
      );
      revealEls.forEach((el) => revealObserver!.observe(el));
    }

    // Spotlight (mouse-tracked radial glow)
    const spotlightEls = Array.from(document.querySelectorAll<HTMLElement>("[data-spotlight]"));
    const onSpotlight = (e: MouseEvent) => {
      const el = e.currentTarget as HTMLElement;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
      el.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
    };
    spotlightEls.forEach((el) => el.addEventListener("mousemove", onSpotlight));

    // 3D tilt
    const tiltEls = Array.from(document.querySelectorAll<HTMLElement>("[data-tilt]"));
    const onTiltMove = (e: MouseEvent) => {
      const el = e.currentTarget as HTMLElement;
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      const max = 6; // degrees
      el.style.setProperty("--rx", `${(-py * max).toFixed(2)}deg`);
      el.style.setProperty("--ry", `${(px * max).toFixed(2)}deg`);
      el.style.setProperty("--mx", `${(px * 100 + 50).toFixed(1)}%`);
      el.style.setProperty("--my", `${(py * 100 + 50).toFixed(1)}%`);
    };
    const onTiltLeave = (e: MouseEvent) => {
      const el = e.currentTarget as HTMLElement;
      el.style.setProperty("--rx", "0deg");
      el.style.setProperty("--ry", "0deg");
    };
    if (!prefersReduced) {
      tiltEls.forEach((el) => {
        el.addEventListener("mousemove", onTiltMove);
        el.addEventListener("mouseleave", onTiltLeave);
      });
    }

    // Pricing viewed (once per session)
    let pricingObserver: IntersectionObserver | null = null;
    const pricingEl = document.getElementById("pricing");
    const alreadyFired = sessionStorage.getItem("pricing_viewed_fired");
    if (pricingEl && !alreadyFired) {
      pricingObserver = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              track("pricing_viewed");
              try { sessionStorage.setItem("pricing_viewed_fired", "1"); } catch { /* no-op */ }
              pricingObserver?.disconnect();
              break;
            }
          }
        },
        { threshold: 0.3 },
      );
      pricingObserver.observe(pricingEl);
    }

    return () => {
      revealObserver?.disconnect();
      pricingObserver?.disconnect();
      spotlightEls.forEach((el) => el.removeEventListener("mousemove", onSpotlight));
      tiltEls.forEach((el) => {
        el.removeEventListener("mousemove", onTiltMove);
        el.removeEventListener("mouseleave", onTiltLeave);
      });
    };
  }, []);
}



export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "visaworker.ai — Open-source AI drafting agent for your immigration petition" },
      {
        name: "description",
        content:
          "An open-source AI agent that builds your O-1A, EB-1A, or NIW petition. It finds the evidence, structures the case, and writes every criterion. Free to start or self-host; $249 to unlock hosted.",
      },
      {
        name: "keywords",
        content:
          "O-1A petition, EB-1A petition, NIW petition, extraordinary ability visa, immigration drafting agent, AI immigration petition, self-petition visa, open source immigration software",
      },
      { property: "og:title", content: "visaworker.ai — Open-source AI drafting agent for your immigration petition" },
      {
        property: "og:description",
        content:
          "An open-source AI agent that builds your O-1A, EB-1A, or NIW petition. It finds the evidence, structures the case, and writes every criterion. Free to start or self-host; $249 to unlock hosted.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://visaworker.ai/" },
      { property: "og:site_name", content: "visaworker.ai" },
      { property: "og:locale", content: "en_US" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "visaworker.ai — Open-source AI drafting agent for your immigration petition" },
      {
        name: "twitter:description",
        content:
          "An open-source AI agent that builds your O-1A, EB-1A, or NIW petition. It finds the evidence, structures the case, and writes every criterion. Free to start or self-host; $249 to unlock hosted.",
      },
      { property: "og:image", content: "https://visaworker.ai/og-home.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "visaworker.ai — the AI drafting agent for your immigration petition." },
      { name: "twitter:image", content: "https://visaworker.ai/og-home.png" },
      { name: "twitter:image:alt", content: "visaworker.ai — the AI drafting agent for your immigration petition." },
    ],
    links: [{ rel: "canonical", href: "https://visaworker.ai/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify([
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "visaworker.ai",
            url: "https://visaworker.ai/",
            logo: "https://visaworker.ai/favicon.svg",
            sameAs: [] as string[],
          },
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "visaworker.ai",
            url: "https://visaworker.ai/",
          },
          {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "visaworker.ai",
            applicationCategory: "LegalService",
            operatingSystem: "Web",
            description:
              "A drafting agent for O-1A, EB-1A, and NIW petitions. Structured sections, web-captured exhibits, citations in sync.",
            offers: { "@type": "Offer", price: "249", priceCurrency: "USD" },
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: [
              {
                "@type": "Question",
                name: "Do I still need a lawyer?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "visaworker.ai is not a law firm and does not provide legal advice or representation. The workspace is a drafting tool that helps structure, source, and format your petition. Whether you work with an attorney or file on your own is your decision.",
                },
              },
              {
                "@type": "Question",
                name: "How fast is a first draft?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Most users have a serious first draft the same afternoon they open a case.",
                },
              },
              {
                "@type": "Question",
                name: "Do you offer refunds or guarantee approval?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "No. We do not offer refunds and we are not responsible for determining whether your case meets USCIS standards. We are a drafting tool, not a law firm.",
                },
              },
              {
                "@type": "Question",
                name: "Where does my data go?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Your workspace is isolated to your account and never used to train anything. Encrypted transport, per-case access.",
                },
              },
              {
                "@type": "Question",
                name: "Can you introduce me to an immigration lawyer?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "You can, if you want, request to be introduced to independent third-party lawyers. We only make introductions on request.",
                },
              },
            ],
          },
        ]),
      },
    ],
  }),
});

function Landing() {
  useLandingInteractions();
  return (
    <div className="relative min-h-screen overflow-hidden bg-paper text-ink">
      <PaperBackdrop />

      <RefBanner />

      {/* Top flag ribbon */}
      <div className="relative z-30 h-1 w-full bg-gradient-to-r from-navy via-paper to-crimson" />


      {/* Nav — editorial masthead */}
      <SiteHeader current="home" />



      <main>
      {/* HERO */}
      <section className="relative z-20 md:flex md:min-h-[calc(100svh-76px)] md:items-center">

        <div className="mx-auto grid w-full max-w-[1400px] gap-10 px-6 pb-20 pt-14 md:grid-cols-[1.15fr_1fr] md:gap-16 md:px-10 md:pb-[clamp(3rem,6vh,7rem)] md:pt-[clamp(2rem,4vh,5rem)]">
          {/* Left column */}
          <div className="relative">
            <div className="fade-in-up mb-6 inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-full border border-navy/25 bg-white/70 px-4 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.24em] text-navy backdrop-blur md:mb-[clamp(1rem,2.5vh,2rem)]">
              <Star className="h-3 w-3 fill-crimson text-crimson" />
              <span>Open-source AI for O-1A · EB-1A · NIW</span>
            </div>

            <h1
              className="fade-in-up hero-title font-serif text-[2.6rem] leading-[0.98] tracking-[-0.02em] text-ink sm:text-[4rem] sm:leading-[0.94] md:text-[clamp(3.5rem,7.2vw,5.75rem)] md:leading-[0.94]"
              style={{ animationDelay: "80ms" }}
            >
              A drafting agent for your
              <br />
              <span className="italic text-crimson">immigration petition.</span>
            </h1>

            <p
              className="fade-in-up mt-6 max-w-xl text-base leading-relaxed text-ink/70 sm:mt-8 sm:text-lg md:mt-[clamp(1rem,2.5vh,2rem)] md:text-[clamp(1rem,1.15vw,1.15rem)]"
              style={{ animationDelay: "160ms" }}
            >
              An open-source AI agent that builds your O-1A, EB-1A, or NIW petition for you. It finds the evidence, structures the case, captures exhibits, and writes every criterion. Free to start or self-host; $249 to unlock hosted.
            </p>

            <div
              className="fade-in-up mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4 md:mt-[clamp(1.25rem,3vh,2.5rem)]"
              style={{ animationDelay: "240ms" }}
            >
              <Button
                asChild
                size="lg"
                className="shine-btn group h-14 w-full rounded-none bg-navy px-6 text-[11px] font-bold uppercase tracking-[0.18em] text-paper shadow-[6px_6px_0_0_var(--crimson)] transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-navy-deep hover:shadow-[8px_8px_0_0_var(--crimson)] sm:w-auto sm:px-8 sm:text-[12px] sm:tracking-[0.2em]"
              >
                <Link to="/auth" onClick={() => track("landing_cta_clicked", { location: "hero" })}>
                  Start for free — no card
                  <ArrowUpRight className="ml-1.5 h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="ghost"
                className="h-14 w-full rounded-none border-2 border-ink/20 bg-transparent px-6 text-[11px] font-bold uppercase tracking-[0.18em] text-ink hover:border-ink hover:bg-ink hover:text-paper sm:w-auto sm:text-[12px] sm:tracking-[0.2em]"
              >
                <Link to="/demo">Try the live demo →</Link>
              </Button>
            </div>

            <p
              className="fade-in-up mt-8 text-[10.5px] font-semibold uppercase tracking-[0.22em] text-ink/50 md:mt-[clamp(1rem,2.5vh,2rem)]"
              style={{ animationDelay: "300ms" }}
            >
              Free to start · Unlock for $249 flat · No subscription · Not a law firm
            </p>
            <p
              className="fade-in-up mt-3 text-[11px] font-medium text-ink/60"
              style={{ animationDelay: "340ms" }}
            >
              Refer a friend and earn $50 back — they get $50 off too.{" "}
              <Link to="/auth" className="text-crimson underline decoration-crimson/40 underline-offset-2 hover:text-crimson-deep">
                Get your link
              </Link>
            </p>


            {/* Mobile hero visual */}
            <div
              className="fade-in-up mt-12 md:hidden"
              style={{ animationDelay: "280ms" }}
            >
              <StatueHero />
            </div>
          </div>

          {/* Right column — hero visual */}
          <div
            className="fade-in-up relative hidden md:block"
            style={{ animationDelay: "200ms" }}
          >
            <div className="sticky top-24">
              <div className="ambient-float">
                <StatueHero />
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Red-white-blue stripe divider */}
      <div className="relative z-20 flex h-2 w-full">
        <div className="flex-1 bg-navy" />
        <div className="flex-1 bg-paper" />
        <div className="flex-1 bg-crimson" />
      </div>




      {/* §01 — How it works */}
      <section id="how" className="relative z-10 bg-parchment py-24 md:py-32">
        <div className="mx-auto max-w-[1400px] px-6 md:px-10">
          <div className="mb-14 grid gap-10 md:grid-cols-[1fr_1.3fr] md:items-end md:mb-16">
            <div data-reveal="left">
              <SectionTag num="01" color="crimson">How it works</SectionTag>
              <h2 className="mt-5 font-serif text-3xl leading-[1.05] text-ink sm:text-4xl md:text-5xl">
                Four steps to a
                <br />
                <span className="italic text-crimson">filing-ready dossier.</span>
              </h2>
            </div>
            <p data-reveal="right" className="text-[15px] leading-relaxed text-ink/70 md:text-lg">
              First serious draft the same afternoon. Not next week. Not after a call.
            </p>
          </div>

          <ol data-reveal-stagger className="grid gap-px bg-ink/10 sm:grid-cols-2 lg:grid-cols-4">
            <Step
              n="01"
              icon={Compass}
              title="Open a case."
              body="Pick your visa. We seed the sections USCIS expects."
            />
            <Step
              n="02"
              icon={Link2}
              title="Drop the links."
              body="Papers, patents, press, profiles — captured as numbered exhibits."
            />
            <Step
              n="03"
              icon={Sparkles}
              title="The agent drafts."
              body="Every criterion, in your voice, cited to real exhibits."
            />
            <Step
              n="04"
              icon={FileCheck2}
              title="Compile the PDF."
              body="Cover, TOC, headers, numbered index — ready to file."
            />
          </ol>

          <div className="mt-16 grid gap-8 md:grid-cols-2 md:gap-10">
            <AgentActivityMock />
            <SectionsMock />
          </div>

        </div>
      </section>

      {/* §02 — What you get */}
      <section id="what" className="relative z-10 bg-paper py-24 md:py-32">
        <div className="mx-auto max-w-[1400px] px-6 md:px-10">
          <div data-reveal="scale" className="mx-auto mb-16 max-w-2xl text-center md:mb-20">
            <div className="flex justify-center">
              <SectionTag num="02" color="navy">What you get</SectionTag>
            </div>
            <h2 className="mt-5 font-serif text-3xl leading-[1.05] text-ink sm:text-4xl md:text-6xl">
              Everything a filing needs. <span className="italic text-crimson">Nothing that gets in the way.</span>
            </h2>
          </div>

          <div className="space-y-20 md:space-y-28">
            <CapabilityRow
              group="Drafting"
              items={[
                { title: "Full drafts for every criterion", body: "The agent writes the letter, criterion by criterion, in your voice — with real citations, not placeholders." },
                { title: "Letter workflow", body: "Draft in the signer's voice, send with a magic link, signed letters land as numbered exhibits." },
              ]}
              mock={<CitationsMock />}
            />
            <CapabilityRow
              group="Exhibits"
              items={[
                { title: "Web capture from a paste", body: "Drop a URL — we fetch and snapshot the page, then file it under the criterion it supports." },
                { title: "Numbered index that stays in sync", body: "Reorder, add, or remove exhibits and every citation renumbers itself. No more search-and-replace." },
              ]}
              mock={<ExhibitsMock />}
              flip
            />
            <CapabilityRow
              group="Output"
              items={[
                { title: "Filing-ready compiled PDF", body: "One click compiles a cover, table of contents, running headers, and a full numbered exhibit index." },
                { title: "Attorney-ready workspace", body: "Share the case with counsel or export the whole packet. They review the case, not the formatting." },
              ]}
              mock={<PetitionPostcard />}
            />
          </div>
        </div>
      </section>


      {/* §03 — Priced against the alternative */}
      <section id="pricing" className="relative z-10 border-y border-ink/10 bg-parchment py-24 md:py-32">
        <div className="mx-auto max-w-[1400px] px-6 md:px-10">
          <div className="mb-14 grid gap-10 md:grid-cols-[1fr_1.3fr] md:items-end md:mb-16">
            <div>
              <SectionTag num="03" color="crimson">Priced against the alternative</SectionTag>
              <h2 className="mt-5 font-serif text-3xl leading-[1.05] text-ink sm:text-4xl md:text-5xl">
                Free to start. <span className="italic text-crimson">$249 to file.</span>
              </h2>
            </div>
            <p className="text-[15px] leading-relaxed text-ink/70 md:text-lg">
              Open a case, draft real sections, capture real exhibits — before you decide. Pay only when you're ready to unlock the full budget and download the filing packet.
            </p>
          </div>

          {/* Comparison table */}
          <div className="mb-16 overflow-hidden border border-ink/15 bg-paper shadow-plate md:mb-20">
            {/* Header row — hidden on mobile, we stack on mobile */}
            <div className="hidden grid-cols-4 border-b-2 border-ink/15 bg-parchment text-[10px] font-bold uppercase tracking-[0.24em] text-ink/60 md:grid">
              <div className="p-5" />
              <div className="border-l border-ink/10 p-5">Word + email</div>
              <div className="border-l border-ink/10 p-5">Immigration attorney</div>
              <div className="border-l-2 border-crimson bg-crimson/[0.06] p-5 text-crimson">visaworker.ai</div>
            </div>
            <CompareRow
              label="Drafting"
              word="You, from scratch"
              lawyer="$8K–$15K + weeks"
              us="Agent-drafted, hours"
            />
            <CompareRow
              label="Exhibits"
              word="Manual, renumber by hand"
              lawyer="They chase you for links"
              us="Paste → captured, numbered"
            />
            <CompareRow
              label="Format"
              word="Falls apart at page 40"
              lawyer="Their template"
              us="Compiled PDF, cover + TOC"
            />
            <CompareRow
              label="Timeline"
              word="Your weekends"
              lawyer="4–8 weeks"
              us="First draft the same day"
            />
            <CompareRow
              label="Cost"
              word="Free (in dollars)"
              lawyer="$10,000+"
              us="$249 flat"
              highlight
            />
          </div>

          <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-3">
            <PriceCard
              headline="Free — bring your own key"
              price="$0"
              subtitle="Connect your own Anthropic API key and get the full workspace, forever. Pay Anthropic directly at cost — nothing to us. Or preview with 10 messages, no key required."
              features={[
                "Full drafts for every criterion",
                "Unlimited assistant messages",
                "Filing-ready PDF export",
                "Web-based exhibit capture",
                "You pay Anthropic at cost (~$3–8 / case)",
                "Or 10-message preview — no key needed",
              ]}
              cta="Start free"
              badge="Free forever"
            />
            <PriceCard
              headline="Unlock one case"
              price="$249"
              subtitle="We handle the AI. One flat price covers drafting, revisions, and export for a single O-1A, EB-1A, or NIW petition — no key, no metering, no math."
              features={[
                "We provide & pay for the AI",
                "Full drafts for every criterion",
                "Unlimited assistant messages",
                "Filing-ready PDF export",
                "Download source files & exhibits",
                "Share with your attorney",
              ]}
              cta="Unlock — $249"
              accent
            />
            <PriceCard
              headline="More room"
              price="+$100"
              subtitle="Top up drafting budget any time — for long rewrites, extra rounds, or a second visa track."
              features={[
                "Add drafting budget as you go",
                "Same case, no re-purchase",
                "Stackable — top up as often as you like",
                "No monthly fees",
                "No recurring charges",
              ]}
              cta="See how it works"
            />
          </div>
        </div>
      </section>

      {/* §04 — Testimonials / horror stories */}
      <LandingTestimonialsSection />

      {/* Referral section */}
      <LandingReferralSection />



      {/* Platform preview — live embed, loads on click */}
      <PlatformPreviewSection />

      {/* §05 — FAQ */}

      <section id="faq" className="relative z-10 bg-paper py-24 md:py-28">
        <div className="mx-auto max-w-[1100px] px-6 md:px-10">
          <div className="mb-12 grid gap-10 md:grid-cols-[1fr_1.6fr] md:items-end">
            <div>
              <SectionTag num="05" color="navy">Questions</SectionTag>

              <h2 className="mt-5 font-serif text-3xl leading-[1.05] text-ink sm:text-4xl md:text-5xl">
                The five <span className="italic text-crimson">everyone asks.</span>
              </h2>
            </div>
          </div>


          <dl className="border-t border-ink/15">
            <FaqItem
              q="Do I still need a lawyer?"
              a="visaworker.ai is not a law firm and does not provide legal advice or representation. The workspace is a drafting tool that helps structure, source, and format your petition. Whether you work with an attorney or file on your own is your decision."
            />
            <FaqItem
              q="How fast is a first draft?"
              a="Most users have a serious first draft the same afternoon they open a case. Not a template with blanks — a real draft with your evidence, cited, ready to edit."
            />
            <FaqItem
              q="Do you offer refunds or guarantee approval?"
              a="No refunds once a case is opened. We also don't evaluate whether your background is ready for USCIS — that's between you and your attorney. We are a drafting tool, not a law firm, and we don't guarantee outcomes."
            />
            <FaqItem
              q="Where does my data go?"
              a="Your workspace is isolated to your account and never used to train anything. Encrypted transport, per-case access, and export whenever you want."
            />
            <FaqItem
              q="Can you introduce me to an immigration lawyer?"
              a="You can, if you want, request to be introduced to independent third-party lawyers. We only make introductions on request."
            />
          </dl>
        </div>
      </section>

      {/* §04b — For immigration lawyers */}
      <section className="relative z-10 overflow-hidden bg-navy py-20 text-paper md:py-24">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-crimson via-paper to-crimson" />
        <div className="mx-auto grid max-w-[1400px] gap-10 px-6 md:grid-cols-[1.1fr_1fr] md:items-center md:px-10">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-paper/25 bg-paper/5 px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.22em] text-paper/80">
              <Handshake className="h-3.5 w-3.5" />
              <span>For immigration lawyers</span>
            </div>
            <h2 className="mt-6 font-serif text-3xl leading-[1.05] sm:text-4xl md:text-5xl">
              Run your practice on <span className="italic text-gold">visaworker.ai.</span>
            </h2>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-paper/70 md:text-lg">
              A subscription workspace for firms. Draft faster across every case, manage clients in one place, and choose whether you bear the cost or your clients do.
            </p>
          </div>
          <div className="flex flex-col items-start gap-4 md:items-end">
            <ul className="space-y-2 text-sm text-paper/80 md:text-right">
              <li className="flex items-center gap-2 md:flex-row-reverse"><Check className="h-4 w-4 text-gold" /> Multi-client dashboard</li>
              <li className="flex items-center gap-2 md:flex-row-reverse"><Check className="h-4 w-4 text-gold" /> White-label / co-branded</li>
              <li className="flex items-center gap-2 md:flex-row-reverse"><Check className="h-4 w-4 text-gold" /> Per-seat or per-client billing</li>
            </ul>
            <Button
              asChild
              size="lg"
              className="shine-btn h-14 rounded-none bg-crimson px-8 text-[12px] font-bold uppercase tracking-[0.2em] text-paper shadow-[6px_6px_0_0_var(--paper)] transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-crimson-deep"
            >
              <Link to="/for-lawyers">
                See the lawyer plan
                <ArrowUpRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* §04.5 — Ode to America */}
      <section className="relative z-10 overflow-hidden bg-parchment py-24 md:py-32">
        <div className="relative mx-auto max-w-4xl px-6 text-center md:px-10">
          <div className="flex items-center justify-center gap-3 text-[11px] font-bold uppercase tracking-[0.28em] text-crimson">
            <span className="h-px w-8 bg-crimson/60" />
            <span>An ode to America</span>
            <span className="h-px w-8 bg-crimson/60" />
          </div>
          <h2 className="mt-6 font-serif text-3xl leading-[1.05] text-ink sm:text-4xl md:text-5xl">
            Thank you, <span className="italic text-crimson">America.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-ink/70 md:text-lg">
            For the immigrants who built it — and for the ones still on their way.
          </p>
          <div className="mt-10 overflow-hidden border border-ink/15 bg-ink shadow-[10px_10px_0_0_var(--crimson)]">
            <YouTubeHoverPlayer
              videoId="oJwtT-b8nis"
              title="An ode to America"
            />
          </div>
        </div>
      </section>

      {/* §06 — Open source */}
      <section className="relative z-10 overflow-hidden bg-paper py-20 md:py-24">
        <div className="mx-auto max-w-[1100px] px-6 md:px-10">
          <div className="grid gap-10 md:grid-cols-[1fr_1.4fr] md:items-center">
            <div>
              <SectionTag num="06" color="navy">Open source</SectionTag>
              <h2 className="mt-5 font-serif text-3xl leading-[1.05] text-ink sm:text-4xl md:text-5xl">
                Built in the <span className="italic text-crimson">open.</span>
              </h2>
            </div>
            <div>
              <p className="text-[15px] leading-relaxed text-ink/70 md:text-lg">
                Every prompt, petition template, and exhibit tool that drafts your case is published under a source-available license. Self-host with your own Anthropic key, or trust the hosted version.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="rounded-none border-2 border-ink/20 bg-transparent px-5 py-5 text-[11px] font-bold uppercase tracking-[0.2em] text-ink shadow-none hover:border-ink hover:bg-transparent"
                >
                  <Link to="/open-source">
                    About open source
                    <ArrowUpRight className="ml-2 h-3.5 w-3.5" />
                  </Link>
                </Button>
                <GitHubStarButton className="h-[46px] rounded-none border-2 border-ink/20" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* §05 — Final CTA */}
      <section className="relative z-10 overflow-hidden bg-parchment py-24 md:py-32">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-navy via-paper to-crimson" />
        <div data-reveal="scale" className="relative mx-auto max-w-3xl px-6 text-center md:px-10">
          <SealMark className="mx-auto h-14 w-14" />
          <h2 className="mt-8 font-serif text-3xl leading-[1.05] text-ink sm:text-4xl md:text-6xl">
            Start for free in <span className="italic text-crimson">60 seconds.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-ink/60">
            Pick your visa, drop your links, watch the first draft take shape. Pay $249 only when you're ready to file.
          </p>
          <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
            <Button
              asChild
              size="lg"
              className="shine-btn h-14 rounded-none bg-crimson px-8 text-[12px] font-bold uppercase tracking-[0.2em] text-paper shadow-[6px_6px_0_0_var(--navy)] transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[8px_8px_0_0_var(--navy)]"
            >
              <Link to="/auth" onClick={() => track("landing_cta_clicked", { location: "pricing" })}>Start for free — no card</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="ghost"
              className="h-14 rounded-none border-2 border-ink/20 bg-transparent px-6 text-[12px] font-bold uppercase tracking-[0.2em] text-ink hover:border-ink hover:bg-ink hover:text-paper"
            >
              <Link to="/demo">Try the live demo →</Link>
            </Button>
          </div>
          <p className="mt-6 text-xs text-ink/50">
            No card to preview · $249 flat to unlock · Not a law firm.
          </p>
        </div>
      </section>
      </main>

      <footer className="relative z-10 border-t border-ink/10 bg-paper">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4 px-6 py-8 text-xs text-ink/75 md:px-10">

          <p className="tracking-wide">
            © {new Date().getFullYear()} visaworker.ai · Not legal advice · Your data stays yours.
          </p>
          <div className="flex items-center gap-5">
            <Link to="/terms" className="hover:text-crimson">Terms</Link>
            <Link to="/privacy" className="hover:text-crimson">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* --------- Components --------- */

function PlatformPreviewSection() {
  const [loaded, setLoaded] = useState(false);
  return (

    <section className="relative z-10 overflow-hidden bg-paper py-24 md:py-32">
      <div className="mx-auto max-w-[1400px] px-6 md:px-10">
        <div className="mb-10 grid gap-10 md:grid-cols-[1fr_1.3fr] md:items-end md:mb-14">
          <div data-reveal="left">
            <SectionTag num="00" color="navy">See the platform</SectionTag>
            <h2 className="mt-5 font-serif text-3xl leading-[1.05] text-ink sm:text-4xl md:text-5xl">
              The workspace, <span className="italic text-crimson">live.</span>
            </h2>
          </div>
          <p data-reveal="right" className="text-[15px] leading-relaxed text-ink/70 md:text-lg">
            A shared demo case, seeded with Elon Musk's EB-1A. Chat with the agent, browse exhibits, and see real drafted sections — no signup.
          </p>
        </div>

        <div
          data-reveal="scale"
          className="relative mx-auto overflow-hidden border border-ink/15 bg-navy shadow-[12px_12px_0_0_var(--crimson)]"
        >
          {/* Browser chrome */}
          <div className="flex items-center gap-2 border-b border-ink/20 bg-parchment px-4 py-2.5">
            <div className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-crimson/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-gold/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-navy/40" />
            </div>
            <div className="ml-3 flex-1 truncate rounded-sm border border-ink/10 bg-paper px-3 py-1 text-[11px] font-mono text-ink/60">
              visaworker.ai/projects/elon-musk-eb1a
            </div>
            <Link
              to="/demo"
              className="hidden shrink-0 items-center gap-1 rounded-sm bg-navy px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-paper hover:bg-navy-deep sm:flex"
            >
              Open full <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>

          {/* Live iframe — only mounts after the user clicks */}
          <div className="relative aspect-[9/16] w-full bg-parchment sm:aspect-[16/10]">
            {loaded ? (
              <iframe
                src="/demo"
                title="visaworker.ai live platform preview"
                loading="lazy"
                className="absolute inset-0 h-full w-full border-0"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  track("landing_demo_opened");
                  setLoaded(true);
                }}
                className="group absolute inset-0 flex flex-col items-center justify-center gap-5 bg-gradient-to-br from-parchment via-paper to-parchment text-ink transition hover:from-paper hover:to-parchment"
                aria-label="Load the live platform preview"
              >
                <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-ink bg-paper shadow-[4px_4px_0_0_var(--crimson)] transition group-hover:-translate-x-0.5 group-hover:-translate-y-0.5 group-hover:shadow-[6px_6px_0_0_var(--crimson)]">
                  <svg viewBox="0 0 24 24" className="ml-1 h-6 w-6 fill-ink" aria-hidden="true">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
                <span className="text-[11px] font-bold uppercase tracking-[0.28em] text-ink/70">
                  Click to load the live preview
                </span>
                <span className="max-w-md px-6 text-center text-xs text-ink/50">
                  We keep it off by default so the landing page stays fast.
                </span>
              </button>
            )}
          </div>

        </div>

        <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <Button
            asChild
            size="lg"
            className="shine-btn h-14 rounded-none bg-navy px-8 text-[12px] font-bold uppercase tracking-[0.2em] text-paper shadow-[6px_6px_0_0_var(--crimson)] transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-navy-deep hover:shadow-[8px_8px_0_0_var(--crimson)]"
          >
            <Link to="/demo">
              Open the full demo
              <ArrowUpRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="ghost"
            className="h-14 rounded-none border-2 border-ink/20 bg-transparent px-6 text-[12px] font-bold uppercase tracking-[0.2em] text-ink hover:border-ink hover:bg-ink hover:text-paper"
          >
            <Link to="/auth">Start your own case</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}


function SectionTag({
  num,
  children,
  color,
  onDark,
}: {
  num: string;
  children: React.ReactNode;
  color: "crimson" | "navy" | "gold";
  onDark?: boolean;
}) {
  const colorClass =
    color === "crimson" ? "text-crimson" : color === "navy" ? "text-navy" : "text-gold";
  const lineColor =
    color === "crimson" ? "bg-crimson" : color === "navy" ? "bg-navy" : "bg-gold";
  return (
    <div className={`flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.28em] ${colorClass}`}>
      <span className={`h-px w-8 ${lineColor}`} />
      <span>{num}</span>
      <span className={`opacity-60 ${onDark ? "text-paper/60" : "text-ink/60"}`}>· {children}</span>
    </div>
  );
}

function Step({
  n,
  icon: Icon,
  title,
  body,
}: {
  n: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  body: string;
}) {
  return (
    <div
      data-reveal
      data-tilt
      className="group relative flex flex-col gap-4 overflow-hidden bg-paper p-6 transition-colors hover:bg-white sm:p-7"
    >
      <div className="flex items-center justify-between">
        <span className="gold-sweep font-serif text-4xl leading-none text-crimson">{n}</span>
        <span className="inline-flex h-10 w-10 items-center justify-center border border-navy/25 bg-parchment transition-all duration-300 group-hover:-translate-y-0.5 group-hover:rotate-3 group-hover:border-crimson">
          <Icon className="h-4.5 w-4.5 text-navy transition-colors group-hover:text-crimson" strokeWidth={1.5} />
        </span>
      </div>
      <div className="h-px w-full rule-navy" />
      <h3 data-tilt-lift className="font-serif text-xl leading-tight text-ink">{title}</h3>
      <p className="text-[14px] leading-relaxed text-ink/70">{body}</p>
    </div>
  );
}

function CapabilityRow({
  group,
  items,
  mock,
  flip,
}: {
  group: string;
  items: { title: string; body: string }[];
  mock: React.ReactNode;
  flip?: boolean;
}) {
  return (
    <div className={`grid items-center gap-10 md:grid-cols-2 md:gap-16 ${flip ? "md:[&>*:first-child]:order-2" : ""}`}>
      <div data-reveal={flip ? "right" : "left"}>
        <div className="relative">{mock}</div>
      </div>
      <div data-reveal={flip ? "left" : "right"}>
        <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.28em] text-crimson">
          <span className="h-px w-8 bg-crimson" />
          <span>{group}</span>
        </div>
        <ul className="mt-8 space-y-8">
          {items.map((it) => (
            <li key={it.title}>
              <div className="flex items-start gap-3">
                <Check className="mt-1.5 h-4 w-4 shrink-0 text-crimson" strokeWidth={3} />
                <div>
                  <h3 className="font-serif text-xl leading-tight text-ink sm:text-2xl">{it.title}</h3>
                  <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-ink/70">{it.body}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function CompareRow({
  label,
  word,
  lawyer,
  us,
  highlight,
}: {
  label: string;
  word: string;
  lawyer: string;
  us: string;
  highlight?: boolean;
}) {
  return (
    <div className="grid gap-0 border-b border-ink/10 last:border-b-0 md:grid-cols-4">
      <div className="border-b border-ink/10 bg-parchment px-5 py-4 text-[10px] font-bold uppercase tracking-[0.24em] text-navy md:border-b-0 md:border-r md:border-ink/10">
        {label}
      </div>
      <CompareCell headerOnMobile="Word + email" tone="bad">
        {word}
      </CompareCell>
      <CompareCell headerOnMobile="Attorney" tone="bad">
        {lawyer}
      </CompareCell>
      <CompareCell headerOnMobile="visaworker.ai" tone="good" highlight={highlight}>
        {us}
      </CompareCell>
    </div>
  );
}

function CompareCell({
  children,
  headerOnMobile,
  tone,
  highlight,
}: {
  children: React.ReactNode;
  headerOnMobile: string;
  tone: "good" | "bad";
  highlight?: boolean;
}) {
  return (
    <div
      className={
        "flex items-center gap-3 border-b border-ink/10 px-5 py-4 text-[14px] last:border-b-0 md:border-b-0 md:border-l md:border-ink/10 " +
        (tone === "good"
          ? `border-l-2 md:border-l-2 md:!border-crimson ${highlight ? "bg-crimson/[0.08] font-semibold text-crimson" : "bg-crimson/[0.04] text-ink"}`
          : "text-ink/70")
      }
    >
      <span className="min-w-[110px] text-[10px] font-bold uppercase tracking-[0.22em] text-ink/40 md:hidden">
        {headerOnMobile}
      </span>
      <span className="flex flex-1 items-center gap-2">
        {tone === "good" ? (
          <Check className="h-3.5 w-3.5 shrink-0 text-crimson" strokeWidth={3} />
        ) : tone === "bad" ? (
          <X className="h-3.5 w-3.5 shrink-0 text-ink/30" strokeWidth={2.5} />
        ) : (
          <Minus className="h-3.5 w-3.5 shrink-0 text-ink/30" strokeWidth={2.5} />
        )}
        <span>{children}</span>
      </span>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <div className="grid gap-4 border-b border-ink/15 py-8 md:grid-cols-[1fr_1.6fr] md:gap-10">
      <dt className="font-serif text-xl leading-tight text-ink md:text-2xl">{q}</dt>
      <dd className="text-[15px] leading-relaxed text-ink/70 md:text-base">{a}</dd>
    </div>
  );
}

function PriceCard({
  headline, price, subtitle, features, cta, accent, badge,
}: {
  headline: string;
  price: string;
  subtitle: string;
  features: string[];
  cta: string;
  accent?: boolean;
  badge?: string;
}) {
  return (
    <div
      data-reveal
      data-tilt
      className={
        "relative flex flex-col border-2 p-8 md:p-10 " +
        (accent
          ? "border-crimson bg-paper shadow-[10px_10px_0_0_var(--navy)]"
          : "border-ink/15 bg-paper")
      }
    >
      {accent && (
        <div className="absolute -top-3 left-8 bg-crimson px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-paper">
          Most people start here
        </div>
      )}
      {!accent && badge && (
        <div className="absolute -top-3 left-8 bg-navy px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-paper">
          {badge}
        </div>
      )}
      <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-navy">
        {headline}
      </p>
      <p className="mt-4 font-serif text-5xl leading-none text-ink sm:text-6xl md:text-7xl">{price}</p>
      <p className="mt-3 text-sm leading-relaxed text-ink/70">{subtitle}</p>

      <div className="mt-6 h-px w-full rule-gold" />

      <ul className="mt-6 space-y-3">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-3 text-[15px] text-ink/80">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-crimson" strokeWidth={3} />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div className="mt-10">
        <Button
          asChild
          size="lg"
          className={
            "shine-btn group h-12 w-full rounded-none text-[11px] font-bold uppercase tracking-[0.22em] " +
            (accent
              ? "bg-crimson text-paper hover:bg-crimson-deep"
              : "border-2 border-ink bg-transparent text-ink hover:bg-ink hover:text-paper")
          }
        >
          <Link to="/auth" onClick={() => track("landing_cta_clicked", { location: "footer" })}>
            {cta}
            <ChevronRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function SealMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={`h-10 w-10 ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="20" cy="20" r="18.5" className="text-navy" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="20" cy="20" r="14.5" className="text-gold" stroke="currentColor" strokeWidth="0.6" />
      <path
        d="M20 8l2.5 5.2 5.7.6-4.2 3.9 1.2 5.6L20 20.5 14.8 23.3l1.2-5.6L11.8 13.8l5.7-.6L20 8z"
        className="text-crimson"
        fill="currentColor"
      />
    </svg>
  );
}

/* --------- Statue hero visual --------- */
function StatueHero() {
  return (
    <div className="relative">
      {/* Back card (rotated) */}
      <div className="absolute inset-0 translate-x-3 translate-y-3 rotate-2 border border-ink/10 bg-parchment shadow-plate" />
      {/* Main frame */}
      <div className="relative overflow-hidden border border-ink/15 bg-parchment shadow-plate">
        <img
          src={statueOfLiberty}
          alt="Statue of Liberty — etched engraving in parchment tones"
          width={896}
          height={1408}
          className="block h-[560px] w-full object-cover object-center md:h-[640px]"
        />
        {/* Parchment wash */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-parchment via-parchment/20 to-transparent" />
        <div className="pointer-events-none absolute inset-0 bg-paper-grain opacity-30 mix-blend-multiply" />

        {/* Bottom caption plate */}
        <div className="absolute inset-x-0 bottom-0 border-t border-ink/15 bg-paper/95 px-6 py-4 backdrop-blur-sm">
          <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.28em] text-navy">
            <span>Est. 1886</span>
            <span className="text-crimson">Liber · Tas</span>
          </div>
          <p className="mt-2 font-serif text-lg italic leading-snug text-ink">
            "Give me your tired, your yearners of extraordinary ability…"
          </p>
        </div>
      </div>

      {/* Stamp corner — sits on top of the frame */}
      <div className="absolute -right-3 -top-3 z-10 flex h-20 w-20 rotate-6 items-center justify-center border-2 border-crimson bg-paper text-center shadow-plate">
        <div>
          <p className="font-serif text-[10px] uppercase leading-tight tracking-[0.15em] text-crimson">
            New<br />American
          </p>
          <p className="mt-0.5 font-serif text-[9px] italic text-ink/60">est. you</p>
        </div>
      </div>


      {/* Floating tag */}
      <div className="absolute -bottom-4 -left-4 rotate-[-4deg] bg-navy px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-paper shadow-[4px_4px_0_0_var(--crimson)]">
        Make your American dream a reality

      </div>
    </div>
  );
}

/* --------- Hero postcard --------- */

function PetitionPostcard() {
  return (
    <div className="relative">
      {/* Back card (rotated) */}
      <div className="absolute inset-0 translate-x-3 translate-y-3 rotate-2 border border-ink/10 bg-parchment shadow-plate" />
      {/* Main card */}
      <div className="relative border border-ink/15 bg-white p-8 shadow-plate">
        {/* Stamp corner */}
        <div className="absolute -right-3 -top-3 flex h-20 w-20 rotate-6 items-center justify-center border-2 border-crimson bg-paper text-center">
          <div>
            <p className="font-serif text-[10px] uppercase leading-tight tracking-[0.15em] text-crimson">Filing<br />Ready</p>
            <p className="mt-0.5 font-serif text-[9px] italic text-ink/60">USCIS</p>
          </div>
        </div>

        <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.28em] text-navy">
          <span>Petition · EB-1A</span>
          <span className="text-crimson">Draft v3</span>
        </div>
        <div className="mt-3 h-px w-full rule-gold" />

        <p className="mt-5 font-serif text-[13px] italic text-ink/60">In the matter of —</p>
        <p className="mt-1 font-serif text-2xl leading-tight text-ink">
          Petitioner of extraordinary ability in artificial intelligence research
        </p>

        <div className="mt-6 space-y-3 text-[13px] leading-relaxed text-ink/75">
          <p>
            <span className="font-serif italic text-crimson">Criterion (i)</span> — Receipt of lesser
            nationally or internationally recognized prizes or awards for excellence…
          </p>
          <p>
            <span className="font-serif italic text-crimson">Criterion (v)</span> — Original
            contributions of major significance in the field…
          </p>
          <p>
            <span className="font-serif italic text-crimson">Criterion (vi)</span> — Authorship of
            scholarly articles in professional journals or other major media…
          </p>
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-ink/10 pt-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-ink/50">
          <span>Exhibits · 34</span>
          <span>Pages · 128</span>
          <span className="text-crimson">Ready to file</span>
        </div>
      </div>

      {/* Floating tag */}
      <div className="absolute -bottom-4 -left-4 rotate-[-4deg] bg-navy px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-paper shadow-[4px_4px_0_0_var(--crimson)]">
        Structured · Sourced · Signed by you
      </div>
    </div>
  );
}

/* --------- Workspace mocks --------- */

function SectionsMock() {
  const items = [
    { key: "I.", label: "Cover & Table of Contents", done: true },
    { key: "II.", label: "Statement of Extraordinary Ability", done: true },
    { key: "III.", label: "Criterion (i) — Prizes & Awards", done: true },
    { key: "IV.", label: "Criterion (v) — Original Contributions", done: false, active: true },
    { key: "V.", label: "Criterion (vi) — Scholarly Articles", done: false },
    { key: "VI.", label: "Final Merits Determination", done: false },
    { key: "VII.", label: "Exhibit Index", done: false },
  ];
  return (
    <div className="relative border border-ink/15 bg-white shadow-plate">
      <div className="flex items-center justify-between border-b border-ink/10 bg-parchment px-5 py-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-navy">Sections · EB-1A</span>
        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-crimson">3 / 7</span>
      </div>
      <ul className="divide-y divide-ink/10">
        {items.map((it) => (
          <li
            key={it.key}
            className={`flex items-center gap-4 px-5 py-3 text-[13px] ${
              it.active ? "bg-crimson/5" : ""
            }`}
          >
            <span className="w-8 font-serif italic text-crimson">{it.key}</span>
            <span className={`flex-1 ${it.done ? "text-ink/50 line-through decoration-crimson/40" : "text-ink"}`}>
              {it.label}
            </span>
            {it.done ? (
              <Check className="h-3.5 w-3.5 text-crimson" strokeWidth={3} />
            ) : it.active ? (
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-crimson">Drafting</span>
            ) : (
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-ink/40">Pending</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ExhibitsMock() {
  const rows = [
    { n: "08", src: "arxiv.org", title: "Attention Is All You Need — Citations 84k+" },
    { n: "09", src: "patents.google.com", title: "US11,234,567 — Neural rank prediction" },
    { n: "10", src: "techcrunch.com", title: "Series A: $22M to reinvent search infra" },
    { n: "11", src: "neurips.cc", title: "Invited talk — NeurIPS 2024 workshop chair" },
  ];
  return (
    <div className="relative border border-ink/15 bg-white shadow-plate">
      <div className="flex items-center justify-between border-b border-ink/10 bg-parchment px-5 py-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-navy">Exhibits</span>
        <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.2em] text-crimson">
          <Link2 className="h-3 w-3" /> Paste a URL
        </span>
      </div>
      <ul className="divide-y divide-ink/10">
        {rows.map((r) => (
          <li key={r.n} className="flex items-start gap-4 px-5 py-3 text-[13px]">
            <span className="mt-0.5 border border-navy/30 px-1.5 py-0.5 font-mono text-[10px] tracking-widest text-navy">
              EX-{r.n}
            </span>
            <div className="flex-1">
              <p className="text-ink">{r.title}</p>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/50">{r.src}</p>
            </div>
            <Check className="mt-1 h-3.5 w-3.5 text-crimson" strokeWidth={3} />
          </li>
        ))}
      </ul>
      <div className="border-t border-ink/10 bg-parchment px-5 py-2.5 text-[10px] font-mono uppercase tracking-[0.2em] text-ink/50">
        Fetched · Snapshotted · Filed
      </div>
    </div>
  );
}

function CitationsMock() {
  return (
    <div className="relative border border-ink/15 bg-white p-6 shadow-plate">
      <div className="flex items-center justify-between border-b border-ink/10 pb-3 text-[10px] font-bold uppercase tracking-[0.24em] text-navy">
        <span>Draft · Criterion (v)</span>
        <span className="text-crimson">Auto-sync</span>
      </div>
      <p className="mt-4 font-serif text-[15px] leading-relaxed text-ink/85">
        The petitioner's contributions to transformer-based ranking have been
        adopted widely across the field, as evidenced by{" "}
        <CitationChip n="08" /> and independently corroborated in{" "}
        <CitationChip n="11" />. The underlying method is protected by{" "}
        <CitationChip n="09" /> and cited by industry press including{" "}
        <CitationChip n="10" />.
      </p>
      <div className="mt-6 border-t border-ink/10 pt-4">
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-ink/50">Reorder exhibits →</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {["08", "09", "10", "11"].map((n) => (
            <span key={n} className="border border-navy/30 bg-parchment px-2 py-1 font-mono text-[10px] tracking-widest text-navy">
              EX-{n}
            </span>
          ))}
          <span className="ml-1 self-center text-[10px] font-mono uppercase tracking-[0.2em] text-crimson">
            → citations renumber
          </span>
        </div>
      </div>
    </div>
  );
}

function CitationChip({ n }: { n: string }) {
  return (
    <span className="mx-0.5 inline-flex items-baseline gap-1 border-b border-crimson/60 font-mono text-[11px] text-crimson">
      EX-{n}
    </span>
  );
}

function AgentActivityMock() {
  const steps = [
    { kind: "READ", body: "Parsed 3 arXiv URLs · captured as EX-08, EX-11, EX-14", tone: "navy" },
    { kind: "DRAFT", body: "Criterion (v) — original contributions · 412 words", tone: "crimson" },
    { kind: "CITE", body: "Wired 6 exhibits into the draft · index renumbered", tone: "navy" },
    { kind: "COMPILE", body: "PDF built · 118 pages · 0 errors", tone: "crimson" },
  ] as const;
  return (
    <div className="relative flex flex-col border border-ink/15 bg-white shadow-plate">
      <div className="flex items-center justify-between border-b border-ink/10 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.24em] text-navy">
        <span>Agent · Chat</span>
        <span className="flex items-center gap-1.5 text-crimson">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-crimson opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-crimson" />
          </span>
          Working
        </span>
      </div>

      <div className="flex flex-col gap-4 px-5 py-5">
        <div className="flex justify-end">
          <div className="max-w-[85%] border border-navy/25 bg-parchment px-3.5 py-2 font-serif text-[14px] leading-snug text-ink">
            Hey, I'm Jane Doe, cofounder at StartupX.
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-ink/40">Agent</span>
          <p className="font-serif text-[14px] leading-snug text-ink/85">
            Let me start by finding out everything there is to know about you…
          </p>
          {steps.map((s) => (
            <div key={s.kind} className="flex items-start gap-3">
              <span className={`mt-0.5 w-[68px] shrink-0 border px-1.5 py-0.5 text-center font-mono text-[9px] font-bold tracking-[0.14em] ${s.tone === "crimson" ? "border-crimson/40 bg-crimson/5 text-crimson" : "border-navy/30 bg-parchment text-navy"}`}>
                {s.kind}
              </span>
              <span className="font-serif text-[14px] leading-snug text-ink/85">{s.body}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 pl-[80px] pt-0.5 text-[11px] text-ink/50">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink/40" />
            <span className="font-mono uppercase tracking-[0.18em]">Thinking…</span>
          </div>
        </div>
      </div>

      <div className="mt-auto border-t border-ink/10 bg-paper/60 p-3">
        <div className="flex items-center gap-2 border border-ink/20 bg-white px-3 py-2 shadow-[2px_2px_0_0_var(--navy)]">
          <span className="font-mono text-[11px] tracking-[0.18em] text-navy">›</span>
          <span className="flex-1 truncate font-serif text-[13px] text-ink/50">
            Ask the agent, paste a URL, or drop a PDF…
          </span>
          <span className="flex h-6 w-6 items-center justify-center border border-crimson bg-crimson text-paper">
            <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.5} />
          </span>
        </div>
      </div>
    </div>
  );
}

/* --------- Paper backdrop --------- */
function PaperBackdrop() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 z-0 bg-paper-grain opacity-40" />
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(oklch(0.27 0.09 258 / 0.6) 1px, transparent 1px), linear-gradient(90deg, oklch(0.27 0.09 258 / 0.6) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
          maskImage: "radial-gradient(ellipse at 50% 0%, black 15%, transparent 65%)",
          WebkitMaskImage: "radial-gradient(ellipse at 50% 0%, black 15%, transparent 65%)",
        }}
      />
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-in-up { animation: fadeInUp 0.9s cubic-bezier(0.2, 0.7, 0.2, 1) both; }
        .hero-title { text-wrap: balance; }

        /* --- Scroll reveal --- */
        [data-reveal] {
          opacity: 0;
          transform: translateY(28px);
          transition:
            opacity 900ms cubic-bezier(0.2, 0.7, 0.2, 1),
            transform 900ms cubic-bezier(0.2, 0.7, 0.2, 1);
          transition-delay: var(--reveal-delay, 0ms);
          will-change: opacity, transform;
        }
        [data-reveal="fade"] { transform: translateY(0); }
        [data-reveal="left"] { transform: translateX(-32px); }
        [data-reveal="right"] { transform: translateX(32px); }
        [data-reveal="scale"] { transform: scale(0.96); }
        [data-reveal].is-in {
          opacity: 1;
          transform: translate(0, 0) scale(1);
        }
        /* Auto-stagger children when parent has data-reveal-stagger */
        [data-reveal-stagger] > * { --reveal-delay: 0ms; }
        [data-reveal-stagger] > [data-reveal]:nth-child(1) { --reveal-delay: 0ms; }
        [data-reveal-stagger] > [data-reveal]:nth-child(2) { --reveal-delay: 90ms; }
        [data-reveal-stagger] > [data-reveal]:nth-child(3) { --reveal-delay: 180ms; }
        [data-reveal-stagger] > [data-reveal]:nth-child(4) { --reveal-delay: 270ms; }
        [data-reveal-stagger] > [data-reveal]:nth-child(5) { --reveal-delay: 360ms; }
        [data-reveal-stagger] > [data-reveal]:nth-child(6) { --reveal-delay: 450ms; }

        /* --- 3D tilt card --- */
        [data-tilt] {
          transform-style: preserve-3d;
          transform: perspective(900px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg));
          transition: transform 400ms cubic-bezier(0.2, 0.7, 0.2, 1), box-shadow 300ms ease;
          will-change: transform;
        }
        [data-tilt]:hover {
          box-shadow:
            0 24px 60px -30px oklch(0.19 0.04 255 / 0.35),
            0 0 0 1px oklch(0.78 0.13 82 / 0.25);
        }
        [data-tilt] > * { transform: translateZ(0); }
        [data-tilt] [data-tilt-lift] { transform: translateZ(32px); }

        /* Cursor-following spotlight sheen on cards */
        [data-tilt]::before,
        [data-spotlight]::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: radial-gradient(
            420px circle at var(--mx, 50%) var(--my, 50%),
            oklch(0.78 0.13 82 / 0.14),
            transparent 55%
          );
          opacity: 0;
          transition: opacity 300ms ease;
          mix-blend-mode: plus-lighter;
        }
        [data-tilt]:hover::before,
        [data-spotlight]:hover::before { opacity: 1; }

        /* --- Shine sweep on primary CTAs --- */
        .shine-btn { position: relative; overflow: hidden; isolation: isolate; }
        .shine-btn::after {
          content: "";
          position: absolute;
          top: 0; bottom: 0; left: -60%;
          width: 40%;
          background: linear-gradient(
            110deg,
            transparent 0%,
            oklch(1 0 0 / 0.28) 45%,
            oklch(1 0 0 / 0.42) 50%,
            oklch(1 0 0 / 0.28) 55%,
            transparent 100%
          );
          transform: skewX(-18deg);
          transition: left 700ms cubic-bezier(0.2, 0.7, 0.2, 1);
          pointer-events: none;
        }
        .shine-btn:hover::after { left: 130%; }

        /* --- Underline sweep on nav anchor links --- */
        .nav-link { position: relative; }
        .nav-link::after {
          content: "";
          position: absolute;
          left: 0; right: 0; bottom: -6px;
          height: 1px;
          background: currentColor;
          transform: scaleX(0);
          transform-origin: right center;
          transition: transform 320ms cubic-bezier(0.2, 0.7, 0.2, 1);
        }
        .nav-link:hover::after {
          transform: scaleX(1);
          transform-origin: left center;
        }

        /* --- Number counter shimmer on step tiles --- */
        @keyframes goldSweep {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .gold-sweep {
          background: linear-gradient(
            90deg,
            var(--crimson) 0%,
            var(--navy) 45%,
            var(--crimson) 55%,
            var(--crimson) 100%
          );
          background-size: 200% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .group:hover .gold-sweep { animation: goldSweep 1.4s ease-in-out; }

        /* --- Slow ambient float on hero visual --- */
        @keyframes ambientFloat {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-8px) rotate(0.2deg); }
        }
        .ambient-float { animation: ambientFloat 9s ease-in-out infinite; }

        @media (prefers-reduced-motion: reduce) {
          [data-reveal], .fade-in-up, .ambient-float, .shine-btn::after, .gold-sweep {
            animation: none !important;
            transition: none !important;
            transform: none !important;
            opacity: 1 !important;
          }
        }
      `}</style>
    </>
  );
}

// Suppress unused-var false-positive for icons re-exported for future use.
void Handshake; void Users;
