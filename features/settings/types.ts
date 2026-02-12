import { Json } from "@/lib/store/supabase";
import { LucideIcon } from "lucide-react-native";
import { ReactNode } from "react";
import { SettingsStoreState } from "./store";

export type ProfilePageStat = {
    label: string;
    value?: string | number | boolean;
    icon?: LucideIcon;
    element?: ReactNode;
};

export type ProfileSettings = Record<string, SettingsLayoutSection> & {
    // general: {
    //     location: string;
    //     darkMode: "light" | "dark" | "system";
    //     account: {};
    //     profile: {};
    // };
    // social: {
    //     messages: {};
    //     notifications: {};
    //     blocked: {};
    // };
};

export type SettingsType =
    | "string"
    | "boolean"
    | "number"
    | "page"
    | "custom"
    | "toggle"
    | "select";

type NonBasicSettingType = Exclude<SettingsType, "toggle" | "select" | "page">;

type SelectItemValue = {
    Icon: LucideIcon;
    value: string;
};

type SettingsItem =
    & {
        key?: string;
        label: string;
        Icon: LucideIcon;
        element?: ReactNode;
    }
    & (
        | { type: "toggle"; values: SelectItemValue[] }
        | { type: "select"; values: SelectItemValue[] }
        | { type: "page"; page: SettingsLayoutSection }
        | { type: NonBasicSettingType }
    );

export type SettingsItemData = SettingsItem & SettingsItemValue;

export type SettingsItemValue = {
    key?: string;
    value?:
        | Json
        | SettingsItemValue[]
        | { [key: string]: SettingsItemValue };
};

export type SettingsLayoutSection = {
    label: string;
    items: Record<string, SettingsItemData>;
};

export type Settings = {
    label: string;
    items: SettingsItemValue[];
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
