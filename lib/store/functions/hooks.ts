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
    queryKey: qk.userCollections,
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
      qc.setQueryData(qk.recent, (old) => {
        type Row = Database["public"]["Tables"]["recent_views"]["Row"];

        const prev = (old ?? []) as Partial<Row>[];

        // Find existing entry, if any
        const existing = prev.find((v) => v.item_id === args.id);

        // Remove any existing occurrence of this item from the list
        const withoutCurrent = prev.filter((v) => v.item_id !== args.id);

        // Keep existing fields if present, otherwise create a minimal row
        const item: Partial<Row> = existing ?? {
          item_id: args.id,
          item_type: args.type,
        };

        // Put it at the front, followed by the rest
        return [item, ...withoutCurrent];
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.recent }),
  });
}
