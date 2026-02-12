import { QueryClient } from "@tanstack/react-query";
import { mutation, userProfileOptions } from "../client";

// src/settings/adapters/remote.ts
export type RemoteAdapter = {
    /**
     * Load remote settings for current user.
     * Return a key/value object.
     */
    fetch(): Promise<Record<string, unknown>>;

    /**
     * Patch remote settings (partial update)
     */
    patch(update: Record<string, unknown>): Promise<void>;

    /**
     * Optional: subscribe to remote changes (realtime).
     */
    subscribe?(cb: () => void): () => void;
};

export const remoteSettingsAdapter = (
    opts: { userId: string; queryClient: QueryClient },
): RemoteAdapter => {
    const { queryClient, userId } = opts;
    const queryProfileOptions = userProfileOptions(userId, queryClient);
    return {
        fetch() {
            return queryClient.fetchQuery({
                ...queryProfileOptions,
                staleTime: 60_000, // tune as needed
            });
        },
        patch(update) {
            return mutation({ userId, patch: update }).then(() => {});
        },
    };
};
