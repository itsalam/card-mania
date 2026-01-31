import { CollectionIdArgs } from "@/client/collections/types";
import { CollectionRow } from "@/lib/store/functions/types";
import { Colors } from "react-native-ui-lib";
import { DefaultPageTypes } from "./provider";
import { CollectionData } from "./types";

export const DefaultCollectionData: CollectionData[] = [
    {
        label: "WISHLIST",
        value: 0,
        colors: [Colors.red30, Colors.red40],
        current: 0,
        target: 0,
        unit: "$",
    },
    {
        label: "SELLING",
        value: 0,
        colors: [Colors.green30, Colors.green40],
        current: 0,
        target: 0,
        unit: "$",
    },
    {
        label: "PORTFOLIO",
        value: 0,
        colors: [Colors.blue30, Colors.blue40],
        current: 0,
        target: 0,
        unit: "$",
    },
];

export const DefaultCollectionIndex: Partial<Record<DefaultPageTypes, number>> =
    {
        "wishlist": 0,
        "selling": 1,
        "vault": 2,
    };

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
