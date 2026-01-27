import { CollectionRow } from "@/lib/store/functions/types";

export const isDefaultCollection = (collection: CollectionRow) => {
    return collection.is_wishlist || collection.is_selling ||
        collection.is_vault;
};
