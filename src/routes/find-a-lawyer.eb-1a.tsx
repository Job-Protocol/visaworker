import { createFileRoute } from "@tanstack/react-router";
import { queryOptions } from "@tanstack/react-query";
import { VisaHubPage, visaHubHead } from "@/components/VisaHubPage";
import { fetchFirms } from "@/lib/firms";

const firmsQuery = queryOptions({
  queryKey: ["firms"],
  queryFn: fetchFirms,
  staleTime: 5 * 60_000,
});

export const Route = createFileRoute("/find-a-lawyer/eb-1a")({
  loader: ({ context }) => context.queryClient.ensureQueryData(firmsQuery),
  head: () =>
    visaHubHead({
      path: "/find-a-lawyer/eb-1a",
      title: "EB-1A lawyer cost — compare immigration firms",
      description:
        "Compare EB-1A green card lawyer fees. Flat rates from ~$6k at boutiques to $12–18k at full-service firms. Published pricing, no sales call required.",
    }),
  component: () => (
    <VisaHubPage
      copy={{
        visa: "EB-1A",
        eyebrow: "EB-1A · Extraordinary ability green card",
        h1: "How much does an EB-1A lawyer cost?",
        intro:
          "EB-1A self-petitions are typically flat-fee: expect ~$6,000 at transparent boutiques and $12,000–$18,000 at full-service firms — plus a $1,015 USCIS filing fee and an optional $2,965 premium processing.",
        body: "Because EB-1A allows self-petitioning, many applicants draft the packet themselves and hire counsel only for review and filing. That path can cut total legal spend by more than half. The directory below shows every firm's own published figure where one exists; use the visa filter to focus on firms that explicitly handle EB-1A, then compare pricing transparency at a glance.",
      }}
    />
  ),
});
