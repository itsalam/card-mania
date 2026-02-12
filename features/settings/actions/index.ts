import { Json } from "@/lib/store/supabase";
import { getFromPath } from "../helpers";
import theme from "./theme";

export type ActionUpdate = {
    updates: Record<string, Json | undefined>;
    hasUpdated: true;
} | { hasUpdated: false; updates?: Record<string, Json | undefined> };

export type ActionUpdateTree =
    | ActionUpdate
    | { [key: string]: ActionUpdateTree };

export const registered_actions = {
    general: {
        theme,
    },
};

export default async function preformAction(
    root: Json,
    path: string[],
): Promise<ActionUpdate> {
    try {
        const fx = getFromPath<object>(registered_actions, path) as (
            root: Json,
        ) => ActionUpdate;
        return fx(root);
    } catch (e) {
        console.error(e);
        return { hasUpdated: false };
    }
}
