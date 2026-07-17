import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ExhibitLite = {
  id: string;
  label: string;
  title: string;
  order_index: number;
};

export function useExhibits(projectId: string) {
  return useQuery<ExhibitLite[]>({
    queryKey: ["exhibits-lite", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exhibits")
        .select("id, label, title, order_index")
        .eq("project_id", projectId)
        .order("order_index");
      if (error) throw error;
      return (data ?? []) as ExhibitLite[];
    },
    staleTime: 5_000,
  });
}
