import { ItemKinds, TCollection } from "@/constants/types";
import { DefaultPageTypes } from "@/features/collection/provider";
import { CollectionItemRow, CollectionRow } from "@/lib/store/functions/types";
import { Database } from "@/lib/store/supabase";
import { useInfiniteQuery } from "@tanstack/react-query";

export type UpdateCollection =
    Database["public"]["Tables"]["collections"]["Update"];
export type InsertCollection =
    Database["public"]["Tables"]["collections"]["Insert"];
export type UpdateCollectionTag =
    Database["public"]["Tables"]["collection_tags"]["Update"];
export type InsertCollectionTag =
    Database["public"]["Tables"]["collection_tags"]["Insert"];

export type EditCollectionArgs = {
    // if present we update; if absent we create
    id?: string;
    name: string;
    description?: string | null;
    visibility: TCollection["visibility"];
    cover_image_url?: string | null;
    tags?: string[]; // desired tag ids
};

export type EditCollectionResult = {
    collection: CollectionRow;
    addedTagIds: string[];
    deletedTagIds: string[];
};

export type CollectionView = {
    included: CollectionLike[];
    excluded: CollectionLike[];
};

export type CollectionLike =
    & Partial<
        Database["public"]["Functions"]["collections_with_membership"][
            "Returns"
        ][
            number
        ]
    >
    & Partial<CollectionRow>;

export type CollectionItem =
    Database["public"]["Tables"]["collection_items"]["Row"];

export type EditCollectionArgsItem =
    & Omit<
        Database["public"]["Tables"]["collection_items"]["Insert"],
        "id" | "user_id"
    >
    & {
        id?: string;
        user_id?: string;
        grade_condition?: {
            company_id?: string;
            grade_value?: number;
            label?: string;
            id?: string;
        };
    };

export type InifiniteQueryParams<T = CollectionItemRow> = Parameters<
    typeof useInfiniteQuery<T[]>
>[0];

export type CollectionItemQueryRow =
    Database["public"]["Functions"]["collection_item_query"]["Returns"][number];

export type CollectionIdArgs =
    | {
        collectionId: string;
        collectionType?: Exclude<DefaultPageTypes, "wishlist">;
    }
    | { collectionId?: undefined; collectionType: "wishlist" }
    | { collectionId?: undefined; collectionType: DefaultPageTypes };

export type CollectionReturn = CollectionItemQueryRow;

export type InfQueryOptions<T extends CollectionItemRow> =
    & {
        pageSize?: number;
        search?: string; // e.g. filter by card title (requires a title column in cards)
        kind?: ItemKinds;
    }
    & Partial<InifiniteQueryParams<T>>;
