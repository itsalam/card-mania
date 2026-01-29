import { CollectionIdArgs } from "@/client/collections/types";
import { CollectionRow } from "@/lib/store/functions/types";

export const isDefaultCollection = (collection: CollectionRow) => {
    return collection.is_wishlist || collection.is_selling ||
        collection.is_vault;
};

export const getCollectionName = (
    { collectionKey, collection }: {
        collectionKey: CollectionIdArgs;
        collection?: CollectionRow;
    },
) => {
    if (collectionKey.collectionType) {
        return collectionKey.collectionType[0].toUpperCase() +
            collectionKey.collectionType.slice(1);
    }
    if (collection && !isDefaultCollection(collection)) {
        return collection.name;
    }
};
