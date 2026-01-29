import { getSupabase } from "@/lib/store/client";
import { useQuery } from "@tanstack/react-query";

export function useCardId(cardId: string) {
  // Variant A: call your Supabase Edge Function by name
  return useQuery({
    queryKey: ["card-id", cardId],
    enabled: true,
    queryFn: async () => {
      const { data, error } = await getSupabase().from("cards").select("*").eq(
        "id",
        cardId,
      ).single();

      if (error) {
        throw error;
      }
      return data;
    },
    staleTime: 60_000,
    gcTime: 60_000 * 5,
  });
}

const useCardVariants = (cardId: string) => {
  return useQuery({
    queryKey: ["card-variants", cardId],
    enabled: true,
    queryFn: async () => {
      const { data, error } = await getSupabase().from("cards").select("*").eq(
        "id",
        cardId,
      ).single();

      if (error) {
        throw error;
      }
      return data;
    },
    staleTime: 60_000,
    gcTime: 60_000 * 5,
  });
};
