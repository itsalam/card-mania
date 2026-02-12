import { useUserProfile } from "@/client/profile";
import { Json } from "@/lib/store/supabase";
import { useUserStore } from "@/lib/store/useUserStore";
import _isPlainObject from "lodash/isPlainObject";
import {
    Bell,
    MapPin,
    MessageCircle,
    Monitor,
    Moon,
    PersonStanding,
    ShieldBan,
    Sun,
    SunMoon,
    UserPen,
} from "lucide-react-native";
import { Settings, SettingsItemData, SettingsLayoutSection } from "./types";

const DEFAULT_SETTINGS_SECTIONS: Record<string, SettingsLayoutSection> = {
    general: {
        label: "General & Local info",
        items: {
            location: {
                label: "Location",
                type: "custom",
                Icon: MapPin,
            },
            theme: {
                label: "Theme",
                type: "toggle",
                Icon: SunMoon,
                values: [{
                    Icon: Sun,
                    value: "light",
                }, {
                    Icon: Moon,
                    value: "dark",
                }, {
                    Icon: Monitor,
                    value: "system",
                }],
            },
            account: {
                label: "Account Settings",
                type: "page",
                Icon: PersonStanding,
                page: {
                    label: "Account Settings",
                    items: {},
                },
            },
            profile: {
                label: "Public Profile Settings",
                type: "page",
                Icon: UserPen,
                page: {
                    label: "Account Settings",
                    items: {},
                },
            },
        },
    },
    social: {
        label: "Socials and Interactions",
        items: {
            messages: {
                key: "messages",
                label: "Messages",
                type: "page",
                Icon: MessageCircle,
                page: {
                    label: "Account Settings",
                    items: {},
                },
            },
            notifications: {
                key: "notifications",
                label: "Notifications",
                type: "page",
                Icon: Bell,
                page: {
                    label: "Account Settings",
                    items: {},
                },
            },
            blocked: {
                key: "blocked",
                label: "Blocked",
                type: "page",
                Icon: ShieldBan,
                page: {
                    label: "Account Settings",
                    items: {},
                },
            },
        },
    },
};

const mergeSettingItems = (
    baseItems: Record<string, SettingsItemData>,
    overrides: Json,
): Record<string, SettingsItemData> => {
    const overrideMap = new Map(
        overrides
            ? Object.entries(overrides).map(([key, value]) => [key, value])
            : null,
    );

    const mergeSettings = Object.assign({}, baseItems);
    Object.entries(baseItems).map(([key, item]) => {
        const override = overrideMap.get(key);

        // recursively merge nested items (if they exist)
        const baseNested: Record<string, SettingsItemData> | undefined =
            item.type === "page" ? item?.page.items : undefined;
        const overrideNested: Json = _isPlainObject(override)
            ? override
            : undefined;
        let mergedNested = baseNested;
        if (baseNested) {
            mergedNested = mergeSettingItems(baseNested, overrideNested);
        }

        mergeSettings[key] = {
            ...item,
            value: override,
            ...(mergedNested ? { items: mergedNested } : {}),
        };
    });
    return mergeSettings;
};

const mergeSettingsSections = (
    overrides: Json | undefined,
    defaults: Record<string, SettingsLayoutSection> = DEFAULT_SETTINGS_SECTIONS,
): Record<string, SettingsLayoutSection> => {
    const merged: Record<string, SettingsLayoutSection> = {};

    // merge defaults with overrides
    Object.entries(defaults).forEach(([key, def]) => {
        const override = _isPlainObject(overrides)
            ? (overrides as {
                [key: string]: Json | undefined;
            })[key]
            : undefined;
        merged[key] = {
            label: def.label,
            items: override
                ? mergeSettingItems(def.items, override)
                : {} as Record<string, SettingsItemData>,
        };
    });

    // append override-only sections
    Object.entries(overrides ?? {}).forEach(([key, section]) => {
        if (!merged[key]) {
            merged[key] = {
                label: section.label,
                items: section.items as any,
            };
        }
    });

    return merged;
};

export const useSettingsLayout = () => {
    const { user } = useUserStore();
    const { data: profile } = useUserProfile(user?.id);

    const sections = mergeSettingsSections(
        profile?.preferences as Record<string, Settings> | undefined,
    );

    return { sections, profile };
};

export function getFromPath<T = Json>(root: T, path: string[]): T | undefined {
    let cur: T | undefined = root;

    for (const segment of path) {
        if (cur === null || cur === undefined) return undefined;

        // If we're at an array, the segment must be an index
        if (Array.isArray(cur)) {
            // Only allow non-negative integer indices
            if (!/^(0|[1-9]\d*)$/.test(segment)) return undefined;

            const idx = Number(segment);
            cur = cur[idx]; // out of bounds => undefined (fine)
            continue;
        }

        // If we're at an object, use the segment as a key
        if (typeof cur === "object") {
            // cur is { [key: string]: Json | undefined }
            cur = (cur as { [key: string]: T | undefined })[segment];
            continue;
        }
        // cur is a primitive (string/number/boolean) and still has path left
        return undefined;
    }

    return cur;
}

/**
 * Returns "maximal" existing subpaths (leaf paths) in the Json value:
 * - Each returned path points to a primitive/null, OR an empty object/array.
 * - No returned path is a prefix of another returned path.
 * - Skips object properties whose value is `undefined`.
 * - Array indices are emitted as strings ("0", "1", ...).
 */
export function getLeafSubpaths(root: Json): string[][] {
    const out: string[][] = [];
    const seen = new Set<string>();

    const pushUnique = (path: string[]) => {
        const key = path.join("\u0000");
        if (!seen.has(key)) {
            seen.add(key);
            out.push(path);
        }
    };

    const walk = (node: Json | undefined, path: string[]) => {
        if (node === undefined) return; // treat as non-existent
        if (node === null) {
            pushUnique(path);
            return;
        }

        if (Array.isArray(node)) {
            if (node.length === 0) {
                pushUnique(path); // empty container is a leaf
                return;
            }
            for (let i = 0; i < node.length; i++) {
                walk(node[i], [...path, String(i)]);
            }
            return;
        }

        if (typeof node === "object") {
            const entries = Object.entries(node).filter(([, v]) =>
                v !== undefined
            );
            if (entries.length === 0) {
                pushUnique(path); // empty object (or only undefined props) is a leaf
                return;
            }
            for (const [k, v] of entries) {
                walk(v, [...path, k]);
            }
            return;
        }

        // primitive (string/number/boolean)
        pushUnique(path);
    };

    walk(root, []);
    return out;
}
