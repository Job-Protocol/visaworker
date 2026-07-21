import { createFileRoute } from "@tanstack/react-router";
import { queryOptions } from "@tanstack/react-query";
import { VisaHubPage, visaHubHead } from "@/components/VisaHubPage";
import { fetchFirms } from "@/lib/firms";

const firmsQuery = queryOptions({
  queryKey: ["firms"],
  queryFn: fetchFirms,
  staleTime: 5 * 60_000,
});

export const Route = createFileRoute("/find-a-lawyer/niw")({
  loader: ({ context }) => context.queryClient.ensureQueryData(firmsQuery),
  head: () =>
    visaHubHead({
      path: "/find-a-lawyer/niw",
      title: "NIW lawyer cost — compare EB-2 National Interest Waiver firms",
      description:
        "Compare EB-2 National Interest Waiver lawyer fees. Flat rates from ~$5k at boutiques to $10–15k at full-service firms. Published prices only.",
    }),
  component: () => (
    <VisaHubPage
      copy={{
        visa: "NIW",
        eyebrow: "NIW · EB-2 National Interest Waiver",
        h1: "How much does an NIW lawyer cost?",
        intro:
          "NIW is the most cost-friendly employment-based green card path. Legal fees run ~$5,000 at published-price boutiques and $10,000–$15,000 at full-service firms, plus a $1,015 USCIS filing fee.",
        body: "NIW allows self-petitioning under the Matter of Dhanasar framework — endeavor of substantial merit and national importance, applicant well-positioned to advance it, and a balance-of-factors argument for waiving the labor certification. Many petitioners draft the packet themselves and pay a lawyer only for final review. Compare firms below and pick a path — self-file, attorney review, or full-service.",
      }}
    />
  ),
});
