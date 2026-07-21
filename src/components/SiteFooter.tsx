import { Link } from "@tanstack/react-router";

interface FooterLink {
  label: string;
  to?: string;
  href?: string;
  external?: boolean;
}

interface SiteFooterProps {
  links?: FooterLink[];
}

const DEFAULT_LINKS: FooterLink[] = [
  { label: "Terms", to: "/terms" },
  { label: "Privacy", to: "/privacy" },
];

export function SiteFooter({ links = DEFAULT_LINKS }: SiteFooterProps) {
  return (
    <footer className="border-t border-ink/10 bg-paper">
      <div className="mx-auto max-w-[1400px] px-6 py-8 md:px-10">
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-ink/60">
          <p className="tracking-wide">
            © {new Date().getFullYear()} visaworker.ai · Not legal advice · Your data stays yours.
          </p>
          <div className="flex items-center gap-5">
            {links.map((link) => {
              const className = "hover:text-crimson transition-colors";
              if (link.href || link.external) {
                return (
                  <a
                    key={link.label}
                    href={link.href ?? link.to}
                    className={className}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {link.label}
                  </a>
                );
              }
              return (
                <Link key={link.label} to={link.to ?? "/"} className={className}>
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>

        <p className="mt-5 max-w-[1100px] text-[10px] leading-relaxed text-ink/40">
          Disclaimer: visaworker.ai is not a law firm. For legal advice specific to your case,
          please consult with a licensed attorney. Nothing on this website, including AI-generated
          drafts, guides, and resources, is intended to be legal advice, and use of this site does
          not create an attorney–client relationship. The services offered by visaworker.ai are
          provided for your private use and do not replace the advice of a licensed attorney. Partner
          attorneys listed in our directory are independent professionals, and visaworker.ai is
          not responsible for their legal advice or work product. visaworker.ai is not affiliated
          with or endorsed by United States Citizenship and Immigration Services (USCIS) or any
          other government agency. Blank immigration forms and instructions are available for free at{" "}
          <a
            href="https://www.uscis.gov/forms"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-ink/70"
          >
            uscis.gov/forms
          </a>
          . Use of this site is subject to our{" "}
          <Link to="/terms" className="underline hover:text-ink/70">
            Terms of Use
          </Link>{" "}
          and{" "}
          <Link to="/privacy" className="underline hover:text-ink/70">
            Privacy Policy
          </Link>
          . Questions?{" "}
          <a href="mailto:legal@visaworker.ai" className="underline hover:text-ink/70">
            legal@visaworker.ai
          </a>
          .
        </p>
      </div>
    </footer>
  );
}
