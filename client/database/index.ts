import { supabase } from '@/store/client';
import { useQuery } from "@tanstack/react-query";

export function useCardId(cardId: string){
  // Variant A: call your Supabase Edge Function by name
  return useQuery({
    queryKey: ['card-id', cardId],
    enabled: true,
    queryFn: async () => {
        const { data, error } = await supabase.from('cards').select('*').eq('id', cardId).single()
        
        if (error) {
            throw error
        }
        return data
    },
    staleTime: 60_000,
    gcTime: 60_000*5,
  })

}