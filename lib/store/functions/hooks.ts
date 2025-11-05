// lib/hooks.ts
import { TCard } from "@/constants/types";
import { qk } from "@/lib/store/functions/helpers";
import {
  listMyRecentViews,
  touchRecentView,
} from "@/lib/store/functions/recently-viewed";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Database } from "../supabase";
import {
  addToCollection,
  getCollectionItems,
  listMyCollections,
  removeFromCollection,
} from "./collections";

export function useMyCollections() {
  return useQuery({
    queryKey: qk.collections,
    queryFn: () => listMyCollections(),
  });
}

export function useCollectionItems(collectionId: string) {
  return useQuery({
    queryKey: qk.collectionItems(collectionId),
    queryFn: () => getCollectionItems(collectionId),
    enabled: !!collectionId,
  });
}

export function useAddToCollection(collectionId: string, card: TCard) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      args: {
        p_condition?: string | undefined;
        p_grade?: string | undefined;
        p_quantity?: number | undefined;
      },
    ) =>
      addToCollection({
        p_collection_id: collectionId,
        p_ref_id: card.id,
        p_item_kind: "card",
        ...args,
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: qk.collectionItems(collectionId) }),
  });
}

export function useRemoveFromCollection(collectionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { type: "card" | "listing"; id: string }) =>
      removeFromCollection(collectionId, args.type, args.id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: qk.collectionItems(collectionId) }),
  });
}

export function useRecentViews(limit = 25) {
  return useQuery({
    queryKey: qk.recent,
    queryFn: () => {
      const recents = listMyRecentViews(limit);
      return recents;
    },
  });
}

// Fire-and-forget is fine, but if you show the recent list, invalidate it:
export function useTouchRecentView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      args: { type: "card" | "listing"; id: string; source?: string },
    ) =>
      touchRecentView({
        targetType: args.type,
        targetId: args.id,
        source: args.source,
      }),
    onMutate: async (args) => {
      const prev = qc.getQueryData(qk.recent) as Partial<
        Database["public"]["Tables"]["recent_views"]["Row"]
      >[] | undefined;
      let item;
      const itemIdx = prev?.findIndex((v) => v.item_id === args.id);
      if (itemIdx !== undefined && itemIdx !== -1) {
        item = prev?.splice(itemIdx, 1)[0];
      }
      item = item ?? {
        item_id: args.id,
        item_type: args.type,
      };
      prev?.unshift(item);
      qc.setQueryData(qk.recent, prev);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.recent }),
  });
}
