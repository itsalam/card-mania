export const settingKeys = {
  themeMode: 'themeMode',
  location: 'location',
  systemColorScheme: 'systemColorScheme',
  reduceMotion: 'reduceMotion',
  hapticsEnabled: 'hapticsEnabled',
  priceCurrency: 'priceCurrency',
  notificationsWeeklySummary: 'notificationsWeeklySummary',
  ebayConnect: 'ebayConnect',
} as const

export type SettingKey = keyof typeof settingKeys
