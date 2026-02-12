import { createSettingsHooks } from "./hooks/create-settings-hook";
import { settingsRegistry } from "./registry";
import { createSettingsProvider } from "./settings-provider";

export const { Provider: SettingsProvider, useSettingsStore } =
    createSettingsProvider(settingsRegistry);

export const { useSetting, useHydrated, useTierValue } = createSettingsHooks<
    typeof settingsRegistry
>(useSettingsStore);

export type AppSettingsRegistry = typeof settingsRegistry;
