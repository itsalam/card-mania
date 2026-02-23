// src/settings/registry.ts
import type { SettingsRegistry } from '../types'

export function defineSettings<R extends SettingsRegistry>(registry: R) {
  return registry
}

export function defaultResolver<T>({
  system,
  local,
  remote,
  defaultValue,
}: {
  system?: T
  local?: T
  remote?: T
  defaultValue: T
}): T {
  // default precedence: local > remote > system > default
  // (often you want system only when local says "system", so override per-setting)
  return (local ?? remote ?? system ?? defaultValue) as T
}
