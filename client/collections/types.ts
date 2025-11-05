import { TCollection } from "@/constants/types";
import { Database } from "@/lib/store/supabase";

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

export type CollectionRow = {
    id: string;
    name: string;
    user_id: string;
    description: string | null;
    visibility: TCollection["visibility"];
    cover_image_url: string | null;
    // ...other columns
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

export type CollectionLike = Partial<
    Database["public"]["Functions"]["collections_with_membership"]["Returns"][
        number
    ]
>;

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
    };
