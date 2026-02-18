import { LucideIcon } from "lucide-react-native";
import { ReactNode } from "react";
import { SettingKey } from "./registry";
import { SettingsStoreState } from "./store";

export type ProfilePageStat = {
    label: string;
    value?: string | number | boolean;
    icon?: LucideIcon;
    element?: ReactNode;
};

export type ProfileSettings = Record<string, SettingsLayoutSection>;

export type SettingsType =
    | "string"
    | "boolean"
    | "number"
    | "page"
    | "custom"
    | "toggle"
    | "select";

type NonBasicSettingType = Exclude<SettingsType, "toggle" | "select" | "page">;

type SelectDisplayValue = {
    Icon: LucideIcon;
    value: string;
};

export type SettingsDisplay =
    & {
        key: SettingKey;
        label: string;
        Icon: LucideIcon;
        element?: ReactNode;
    }
    & (
        | { type: "toggle"; values: SelectDisplayValue[] }
        | { type: "select"; values: SelectDisplayValue[] }
        | { type: "page"; page: SettingsLayoutSection }
        | { type: NonBasicSettingType }
    );

export type SettingsLayoutSection = {
    label: string;
    items: Record<string, SettingsDisplay>;
};

// src/settings/types.ts
export type SettingTier = "system" | "local" | "remote";

export type SettingDescriptor<T> = {
    key: string;

    /** default used if nothing exists anywhere */
    defaultValue: T;

    /**
     * Which layers are relevant for this setting.
     * Example:
     * - theme preference: ["system", "local", "remote"]
     * - app-only UI: ["local"]
     * - server policy: ["remote"]
     */
    tiers: SettingTier[];

    /**
     * How to compute the final (effective) value from the available tiers.
     * You decide precedence per setting.
     */
    resolve?: (input: {
        system?: T;
        local?: T;
        remote?: T;
        defaultValue: T;
    }) => T;

    /**
     * Optional validation/serialization hooks.
     * If you use Zod, put Zod parse here.
     */
    validate?: (value: unknown) => value is T;
    serialize?: (value: string) => T;

    /** If remote writes should be debounced, etc. */
    remote?: {
        debounceMs?: number;
    };
};

export type SettingsRegistry = Record<string, SettingDescriptor<any>>;

export type InferSettingValue<
    R extends SettingsRegistry,
    K extends keyof R,
> = R[K] extends SettingDescriptor<infer T> ? T : never;

export type SettingsSnapshot<R extends SettingsRegistry> = {
    [K in keyof R]: InferSettingValue<R, K>;
};

export type UseSettingsStore = <Selected>(
    selector: (s: SettingsStoreState) => Selected,
) => Selected;
