import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/LegalLayout";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — visaworker.ai" },
      {
        name: "description",
        content:
          "How visaworker.ai handles your petition data, what our subprocessors see, and the choices you have. Not a law firm. Not legal advice.",
      },
      { property: "og:title", content: "Privacy Policy — visaworker.ai" },
      {
        property: "og:description",
        content:
          "How visaworker.ai handles your petition data, what our subprocessors see, and the choices you have.",
      },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "https://visaworker.ai/privacy" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Privacy Policy — visaworker.ai" },
      {
        name: "twitter:description",
        content:
          "How visaworker.ai handles your petition data, what our subprocessors see, and the choices you have.",
      },
      { property: "og:image", content: "https://visaworker.ai/og-image.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "visaworker.ai — the AI drafting agent for your immigration petition." },
      { name: "twitter:image", content: "https://visaworker.ai/og-image.png" },
      { name: "twitter:image:alt", content: "visaworker.ai — the AI drafting agent for your immigration petition." },
    ],
    links: [{ rel: "canonical", href: "https://visaworker.ai/privacy" }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" updated="July 1, 2026">
      <p>
        This Privacy Policy explains how visaworker.ai (<strong>"we"</strong>,{" "}
        <strong>"us"</strong>) collects, uses, and protects information when you
        use our software (the <strong>"Service"</strong>). We built the Service
        for people preparing immigration petitions, which means we handle
        sensitive personal information — we take that responsibility seriously.
      </p>

      <h2>1. Information we collect</h2>
      <h3>Information you provide</h3>
      <ul>
        <li>
          <strong>Account information</strong> — email address, display name,
          and authentication credentials.
        </li>
        <li>
          <strong>Case content</strong> — the biographical, professional, and
          evidentiary information you enter or upload for your petition, along
          with drafts and exhibits the Service produces on your behalf.
        </li>
        <li>
          <strong>Communications</strong> — messages you send us for support or
          feedback.
        </li>
      </ul>

      <h3>Information collected automatically</h3>
      <ul>
        <li>
          <strong>Usage data</strong> — pages visited, features used, and
          approximate token consumption per case.
        </li>
        <li>
          <strong>Device and log data</strong> — IP address, browser type,
          operating system, timestamps, and error logs.
        </li>
        <li>
          <strong>Cookies</strong> — a small number of strictly necessary
          cookies used to keep you signed in and to route your session.
        </li>
      </ul>

      <h3>Payment information</h3>
      <p>
        Payments are processed by Stripe. We do not receive or store your full
        card number, CVC, or bank credentials. We do receive limited
        transaction metadata (amount, currency, last four digits, status) to
        reconcile your account.
      </p>

      <h2>2. How we use information</h2>
      <ul>
        <li>To operate the Service, including drafting and compiling your petition.</li>
        <li>To authenticate you and secure your account.</li>
        <li>To process payments and manage token budgets.</li>
        <li>To communicate with you about the Service (transactional messages).</li>
        <li>To detect, prevent, and respond to fraud, abuse, or security incidents.</li>
        <li>To comply with legal obligations.</li>
      </ul>
      <p>
        <strong>
          We do not sell your personal information. We do not use your case
          content to train third-party AI models.
        </strong>
      </p>

      <h2>3. How we share information</h2>
      <p>
        We share information with the third-party subprocessors that operate
        the Service (hosting, database, payments, AI model provider, web
        scraping, and LaTeX compilation). The complete, current list —
        including the specific vendors and what each one processes — is
        maintained in Section 7 of our{" "}
        <a href="/terms">Terms of Service</a>.
      </p>
      <p>Beyond those subprocessors, we may also share information for:</p>
      <ul>
        <li>
          <strong>Legal and safety</strong> — when required by law, valid legal
          process, or to protect the rights, safety, or property of users or
          the public.
        </li>
        <li>
          <strong>Business transfers</strong> — in connection with a merger,
          acquisition, or sale of assets, subject to the receiving party
          honoring this Policy.
        </li>
      </ul>

      <h2>4. Security</h2>
      <p>
        Security is a first-class concern for us. In particular:
      </p>
      <ul>
        <li>
          Case data is scoped per account with database-level row-level
          security, so one user cannot query another user's rows.
        </li>
        <li>Traffic is encrypted in transit using TLS.</li>
        <li>
          Secrets and API keys are stored in an isolated secrets vault,
          separate from application source code.
        </li>
        <li>Access to production systems is restricted and audited.</li>
        <li>Payment card data is handled entirely by Stripe.</li>
      </ul>
      <p>
        No system is perfectly secure. If you believe you have found a
        vulnerability, please email{" "}
        <a href="mailto:security@visaworker.ai">security@visaworker.ai</a>.
      </p>

      <h2>5. Data retention</h2>
      <p>
        We retain your account and case content for as long as your account is
        active. If you delete a case, it is removed from the active Service and
        purged from routine backups within a rolling window. If you delete your
        account, we remove your case content within thirty (30) days, except
        where we are required to retain limited records (for example, payment
        records for tax and audit purposes).
      </p>

      <h2>6. Your rights</h2>
      <p>
        Depending on where you live, you may have the right to access, correct,
        export, or delete your personal information, to object to or restrict
        certain processing, and to lodge a complaint with a data protection
        authority. To exercise these rights, email{" "}
        <a href="mailto:privacy@visaworker.ai">privacy@visaworker.ai</a> from
        the address associated with your account. We will respond within the
        time required by applicable law.
      </p>

      <h2>7. International users</h2>
      <p>
        The Service is operated from and hosted in the United States. If you
        access the Service from outside the United States, you understand that
        your information may be transferred to, stored, and processed in the
        United States and other countries where our providers operate.
      </p>

      <h2>8. Children</h2>
      <p>
        The Service is not directed to children under 18, and we do not
        knowingly collect personal information from children. If you believe a
        child has provided us with personal information, contact us and we will
        delete it.
      </p>

      <h2>9. Changes to this Policy</h2>
      <p>
        We may update this Policy from time to time. Material changes will be
        communicated by updating the "Last updated" date above and, when
        appropriate, by in-app notice.
      </p>

      <h2>10. Contact</h2>
      <p>
        Privacy questions or requests?{" "}
        <a href="mailto:privacy@visaworker.ai">privacy@visaworker.ai</a>.
      </p>
    </LegalLayout>
  );
}
