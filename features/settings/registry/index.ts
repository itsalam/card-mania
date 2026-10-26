import { CitySuggestion } from '../client'
import { settingKeys } from '../keys'
import { SettingDescriptor } from '../types'
import { defineSettings } from './helpers'

type ThemeMode = 'system' | 'light' | 'dark'
type Currency = 'CAD' | 'USD' | 'TWD'
type OnOff = 'on' | 'off'

const isBool = (v: unknown): v is boolean => typeof v === 'boolean'
const isCurrency = (v: unknown): v is Currency => v === 'CAD' || v === 'USD' || v === 'TWD'
const isOnOff = (v: unknown): v is OnOff => v === 'on' || v === 'off'

export type SettingKey = keyof DefaultSettings

export type DefaultSettings = typeof settingsRegistry

const SETTINGS = {
  // This is a *preference* stored locally (and optionally remote):
  themeMode: {
    key: settingKeys.themeMode,
    defaultValue: 'system' as ThemeMode,
    tiers: ['local', 'remote'],
    validate: (v: unknown): v is ThemeMode => v === 'system' || v === 'light' || v === 'dark',
    // Debounce remote writes if user toggles quickly
    remote: { debounceMs: 250 },
  } satisfies SettingDescriptor<ThemeMode>,
  location: {
    key: settingKeys.location,
    defaultValue: null,
    tiers: ['local', 'remote'],
    validate: (v: unknown): v is CitySuggestion => {
      const value = v as CitySuggestion
      return Boolean(value?.city) && Boolean(value?.latitude) && Boolean(value?.longitude)
    },
    // Debounce remote writes if user toggles quickly
    remote: { debounceMs: 250 },
  } satisfies SettingDescriptor<CitySuggestion | null>,
  // This is a SYSTEM state key (no persistence; systemAdapter provides it):
  systemColorScheme: {
    key: settingKeys.systemColorScheme,
    defaultValue: 'light' as 'light' | 'dark',
    tiers: ['system'],
    validate: (v: unknown): v is 'light' | 'dark' => v === 'light' || v === 'dark',
  } satisfies SettingDescriptor<'light' | 'dark'>,

  reduceMotion: {
    key: settingKeys.reduceMotion,
    defaultValue: false,
    tiers: ['system'],
    validate: isBool,
  } satisfies SettingDescriptor<boolean>,

  // app-only preference
  hapticsEnabled: {
    key: settingKeys.hapticsEnabled,
    defaultValue: true,
    tiers: ['local'],
    validate: isBool,
  } satisfies SettingDescriptor<boolean>,

  priceCurrency: {
    key: settingKeys.priceCurrency,
    defaultValue: 'CAD' as Currency,
    tiers: ['local', 'remote'],
    validate: isCurrency,
  } satisfies SettingDescriptor<Currency>,

  // remote-only (server behavior / cross-device)
  notificationsWeeklySummary: {
    key: settingKeys.notificationsWeeklySummary,
    defaultValue: true,
    tiers: ['remote'],
    validate: isBool,
  } satisfies SettingDescriptor<boolean>,

  // dev-only design experiment: outline around collectible card art (see CardFrame).
  // 'on' | 'off' rather than boolean because the settings toggle row is string-valued.
  cardBorders: {
    key: settingKeys.cardBorders,
    defaultValue: 'on' as OnOff,
    tiers: ['local'],
    validate: isOnOff,
  } satisfies SettingDescriptor<OnOff>,
}

export const settingsRegistry = defineSettings(SETTINGS)
