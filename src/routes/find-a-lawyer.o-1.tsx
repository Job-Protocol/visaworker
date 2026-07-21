import { createFileRoute } from "@tanstack/react-router";
import { queryOptions } from "@tanstack/react-query";
import { VisaHubPage, visaHubHead } from "@/components/VisaHubPage";
import { fetchFirms } from "@/lib/firms";

const firmsQuery = queryOptions({
  queryKey: ["firms"],
  queryFn: fetchFirms,
  staleTime: 5 * 60_000,
});

export const Route = createFileRoute("/find-a-lawyer/o-1")({
  loader: ({ context }) => context.queryClient.ensureQueryData(firmsQuery),
  head: () =>
    visaHubHead({
      path: "/find-a-lawyer/o-1",
      title: "O-1 visa lawyer cost — compare immigration firms",
      description:
        "Compare O-1 visa lawyer fees. Boutique flat rates from ~$6k, Big Law $12–20k+. Published prices, offices, and partner discounts side by side.",
    }),
  component: () => (
    <VisaHubPage
      copy={{
        visa: "O-1",
        eyebrow: "O-1 · Extraordinary ability",
        h1: "How much does an O-1 visa lawyer cost?",
        intro:
          "O-1A and O-1B petitions carry some of the widest fee spreads in immigration — from ~$6,000 at published-price boutiques to $15,000+ at large full-service firms.",
        body: "The O-1 category requires evidence of sustained national or international acclaim, so drafting is heavy: expert letters, exhibit indexing, and a detailed petition brief. Firms that publish flat fees usually price O-1 slightly above EB-1A because the employer/agent relationship adds paperwork. Compare the published rates below, then draft your packet in VisaWorker and file with any firm — network partners honor at least a 15% discount on drafts prepared here.",
      }}
    />
  ),
});
