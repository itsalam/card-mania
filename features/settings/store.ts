import { createStore } from "zustand";
import { LocalAdapter } from "./adapters/local-adapter";
import { RemoteAdapter } from "./adapters/remote-adapter";
import { SettingsRegistry, SettingTier } from "./types";

export type SettingsRuntime = {
    registry: SettingsRegistry;
    localAdapter: LocalAdapter;
    remoteAdapter?: RemoteAdapter;
    remoteEnabled: boolean;
};

export type SettingsStoreState = {
    hydrated: boolean;

    tier: {
        system: Record<string, unknown>;
        local: Record<string, unknown>;
        remote: Record<string, unknown>;
    };

    // setters (tier writes)
    setSystemSnapshot: (snapshot: Record<string, unknown>) => void;

    setLocalRaw: (key: string, value: unknown) => void;
    setRemoteRaw: (key: string, value: unknown) => void;

    // computed
    getEffective: (key: string) => unknown;

    // high-level API (validates + persists)
    setTier: (
        key: string,
        tier: Extract<SettingTier, "local" | "remote">,
        value: unknown,
    ) => Promise<boolean>;
};

export function createSettingsStore(runtime: SettingsRuntime) {
    const remoteTimers: Record<string, any> = {};

    const store = createStore<SettingsStoreState>((set, get) => ({
        hydrated: false,
        tier: { system: {}, local: {}, remote: {} },

        setSystemSnapshot(snapshot) {
            set((s) => ({ tier: { ...s.tier, system: snapshot } }));
        },

        setLocalRaw(key, value) {
            set((s) => ({
                tier: { ...s.tier, local: { ...s.tier.local, [key]: value } },
            }));
        },

        setRemoteRaw(key, value) {
            set((s) => ({
                tier: { ...s.tier, remote: { ...s.tier.remote, [key]: value } },
            }));
        },

        getEffective(key) {
            const d = runtime.registry[key];
            if (!d) return undefined;

            const { system, local, remote } = get().tier;

            const sysVal = d.tiers.includes("system") ? system[key] : undefined;
            const localVal = d.tiers.includes("local") ? local[key] : undefined;
            const remoteVal = d.tiers.includes("remote")
                ? remote[key]
                : undefined;

            return (localVal ?? remoteVal ?? sysVal ??
                d.defaultValue) as unknown;
        },

        async setTier(key, tier, value) {
            const d = runtime.registry[key];
            if (!d) {
                console.debug(`missing registry for ${key}`);
                return false;
            }

            if (d.validate && value !== undefined && !d.validate(value)) {
                console.debug(`Invalid value failed for for ${key}`);
                return false;
            }

            if (tier === "local") {
                if (value === undefined) await runtime.localAdapter.remove(key);
                else await runtime.localAdapter.set(key, value);

                get().setLocalRaw(key, value);
                return true;
            }

            // remote
            const prevRemoteValue = get().tier.remote[key];
            get().setRemoteRaw(key, value); // optimistic cache update

            if (!runtime.remoteEnabled || !runtime.remoteAdapter) {
                console.log("Remote writes are disabled");
                return false;
            }

            const debounceMs = d.remote?.debounceMs ?? 0;
            if (remoteTimers[key]) clearTimeout(remoteTimers[key]);

            remoteTimers[key] = setTimeout(async () => {
                try {
                    await runtime.remoteAdapter!.patch({ [key]: value });
                } catch {
                    get().setRemoteRaw(key, prevRemoteValue);
                }
            }, debounceMs);

            return true;
        },
    }));

    return store;
}
