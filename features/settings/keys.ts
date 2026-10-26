export const settingKeys = {
  themeMode: 'themeMode',
  location: 'location',
  systemColorScheme: 'systemColorScheme',
  reduceMotion: 'reduceMotion',
  hapticsEnabled: 'hapticsEnabled',
  priceCurrency: 'priceCurrency',
  notificationsWeeklySummary: 'notificationsWeeklySummary',
  cardBorders: 'cardBorders',
} as const

export type SettingKey = keyof typeof settingKeys
