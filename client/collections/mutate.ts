import { TCollection, TTag } from "@/constants/types";
import { supabase } from "@/lib/store/client";
import { qk, requireUser } from "@/lib/store/functions/helpers";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
    CollectionItem,
    CollectionRow,
    EditCollectionArgs,
    EditCollectionArgsItem,
    EditCollectionResult,
    InsertCollection,
    InsertCollectionTag,
    UpdateCollection,
} from "./types";

const mutateCollectionFn =
    (collectionData: Partial<TCollection> | null) =>
    async (
        args: EditCollectionArgs,
    ) => {
        // 1) Create or update the collection
        let collectionId = args.id || collectionData?.id;
        let collection: CollectionRow;

        if (!collectionData) {
            const user = await requireUser();
            const upsertData: InsertCollection = {
                name: args.name,
                user_id: user.id,
                description: args.description ?? null,
                visibility: args.visibility,
                cover_image_url: args.cover_image_url ?? null,
            };

            const { data, error } = await supabase
                .from("collections")
                .upsert(upsertData)
                .select()
                .single();

            if (error || !data) {
                throw error ?? new Error("No collection returned from upsert");
            }
            collection = data as CollectionRow;
            collectionId = collection.id;
        } else if (collectionData.id) {
            const updateData: Partial<UpdateCollection> = {
                name: args.name,
                description: args.description ?? null,
                visibility: args.visibility,
                cover_image_url: args.cover_image_url ?? null,
            };

            const { data, error } = await supabase
                .from("collections")
                .update(updateData)
                .eq("id", collectionData.id)
                .select()
                .single();

            if (error || !data) {
                throw error ?? new Error("No collection returned from update");
            }
            collection = data as CollectionRow;
            collectionId = collection?.id;
        }

        collectionId = collectionData?.id || collectionId!;

        let addedTagIds: string[] = [];
        let deletedTagIds: string[] = [];

        if (args.tags && collectionId) {
            // get current tags
            const { data: existingRows, error: existingErr } = await supabase
                .from("collection_tags")
                .select("tag_id")
                .eq("collection_id", collectionId);

            if (existingErr) throw existingErr;

            const existing = new Set(
                (existingRows ?? []).map((r) => r.tag_id as string),
            );
            const desired = new Set(args.tags);

            deletedTagIds = [...existing].filter((id) => !desired.has(id));
            addedTagIds = [...desired].filter((id) => !existing.has(id));

            if (deletedTagIds.length) {
                const { error } = await supabase
                    .from("collection_tags")
                    .delete()
                    .eq("collection_id", collectionId)
                    .in("tag_id", deletedTagIds);
                if (error) throw error;
            }

            if (addedTagIds.length) {
                const user = await requireUser(); // only when we actually need it
                const insertData: InsertCollectionTag[] = addedTagIds.map((
                    tag_id,
                ) => ({
                    collection_id: collectionId!,
                    tag_id,
                    user_id: user.id,
                }));
                const { error } = await supabase.from("collection_tags").insert(
                    insertData,
                );
                if (error) throw error;
            }
        }

        // 3) Return a stable, well-defined shape
        return {
            collection: collection!,
            addedTagIds,
            deletedTagIds,
        } as EditCollectionResult;
    };

export const useEditCollection = (
    collectionId?: string,
    cardId?: string,
) => {
    const qc = useQueryClient();
    const collectionData = qc.getQueryData([
        ...qk.collections,
        collectionId,
    ]) as
        | TCollection
        | undefined;

    const collectionTagData = qc.getQueryData([
        ...qk.collections,
        collectionId,
        "tags",
    ]) as TTag["id"][] | undefined;

    return useMutation({
        mutationFn: mutateCollectionFn(collectionData ?? null),
        onMutate: async (patch) => {
            if (collectionData) {
                await qc.cancelQueries({
                    queryKey: [...qk.collections, collectionId],
                });
            }

            const prevCollection = qc.getQueryData<TCollection>([
                ...qk.collections,
                collectionId,
            ]);

            // Optimistically apply patch to detail
            if (prevCollection) {
                qc.setQueryData<TCollection>([
                    ...qk.collections,
                    collectionId,
                ], {
                    ...prevCollection,
                    ...patch,
                });
            }

            return { prev: prevCollection };
        },

        onError: (_err, _vars, ctx) => {
            if (!ctx) return;
            if (ctx.prev) {
                qc.setQueryData(
                    [...qk.collections, ctx.prev.id],
                    ctx.prev,
                );
            }
        },
        onSettled: (_data, _err, vars) => {
            // Revalidate to ensure canonical server state
            const collection = _data?.collection;
            qc.setQueryData([...qk.collections, vars.id], _data?.collection);
            const collectionTags = collectionTagData ?? [];
            const updatedTags = collectionTags.filter(
                (tagId) =>
                    _data?.deletedTagIds.includes(tagId) ||
                    _data?.addedTagIds.includes(tagId),
            ).concat(_data?.addedTagIds ?? []);
            if (collection) {
                qc.setQueryData([
                    ...qk.collections,
                    collectionId,
                    "tags",
                ], updatedTags);
            }
            //Invalidate card in current view if provided
            cardId &&
                qc.invalidateQueries({
                    queryKey: qk.collectionForCard(cardId),
                });
        },
    });
};

const mutateCollectionItemFn = (itemData?: CollectionItem) =>
async (
    args: EditCollectionArgsItem,
) => {
    const user = await requireUser();
    const fullArgs = {
        ...args,
        user_id: args.user_id ?? user.id,
    };
    if (!itemData) {
        const { data, error } = await supabase
            .from("collection_items")
            .upsert(fullArgs)
            .select()
            .single();
        if (error) throw error;
        return data as CollectionItem;
    } else if (itemData.id) {
        {
            const { data, error } = await supabase
                .from("collection_items")
                .update(fullArgs)
                .eq("id", itemData.id)
                .select()
                .single();
            if (error) throw error;
            return data as CollectionItem;
        }
    }
};

export const useEditCollecitonItem = (
    collectionId: string,
    cardId?: string,
    itemId?: string,
) => {
    const qc = useQueryClient();
    const queryKey = [
        ...qk.collectionItems(collectionId),
        ...(cardId ? ["cardId", cardId] : []),
    ];
    const items = qc.getQueryData(queryKey) as
        | (CollectionItem & EditCollectionArgsItem)[]
        | undefined;
    const item = items?.find((it) => it.id === itemId);

    return useMutation({
        mutationFn: mutateCollectionItemFn(item),
        onMutate: async (patch: EditCollectionArgsItem) => {
            if (items) {
                await qc.cancelQueries({
                    queryKey,
                });
            }

            const prevCollectionItems = qc.getQueryData<
                (CollectionItem & EditCollectionArgsItem)[]
            >(
                queryKey,
            );
            const itemIdx = prevCollectionItems?.findIndex((it) =>
                it.id === itemId
            ) ?? -1;
            if (itemIdx === -1) {
                //@ts-ignore
                prevCollectionItems?.push(patch);
            }

            //@ts-ignore
            prevCollectionItems![itemIdx] = {
                ...item,
                ...patch,
            };

            // Optimistically apply patch to detail
            if (prevCollectionItems) {
                qc.setQueryData<(CollectionItem & EditCollectionArgsItem)[]>(
                    queryKey,
                    [
                        ...(prevCollectionItems ?? []).filter((it) =>
                            it.id !== itemId
                        ),
                    ],
                );
            }

            return { prev: prevCollectionItems };
        },

        onError: (_err, _vars, ctx) => {
            if (!ctx) return;
            if (ctx.prev) {
                qc.setQueryData(
                    queryKey,
                    ctx.prev,
                );
            }
        },
        onSettled: (collectionItems, _err, vars) => {
            // Revalidate to ensure canonical server state
            qc.setQueryData(queryKey, collectionItems);

            //Invalidate card in current view if provided
            cardId &&
                qc.invalidateQueries({
                    queryKey,
                });
        },
    });
};
