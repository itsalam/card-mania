import { useSetting } from '@/features/settings'

export type Currency = 'CAD' | 'USD' | 'TWD'

export type CurrencyConfig = {
  symbol: string
  locale: string
  /** Number of decimal places for this currency (e.g. 2 for USD, 0 for TWD) */
  decimals: number
}

export const CURRENCY_CONFIG: Record<Currency, CurrencyConfig> = {
  USD: { symbol: '$', locale: 'en-US', decimals: 2 },
  CAD: { symbol: 'C$', locale: 'en-CA', decimals: 2 },
  TWD: { symbol: 'NT$', locale: 'zh-TW', decimals: 0 },
}

export function useCurrency() {
  const { value: currency } = useSetting('priceCurrency')
  const config = CURRENCY_CONFIG[currency ?? 'USD']
  /** 100 for USD/CAD, 1 for TWD */
  const multiplier = 10 ** config.decimals

  /** Format a stored integer amount into a display string e.g. 1999 → "C$19.99", 150 (TWD) → "NT$150" */
  const formatAmount = (amount: number) =>
    `${config.symbol}${(amount / multiplier).toLocaleString(config.locale, {
      minimumFractionDigits: config.decimals,
      maximumFractionDigits: config.decimals,
    })}`

  return {
    currency: currency ?? 'USD',
    symbol: config.symbol,
    locale: config.locale,
    decimals: config.decimals,
    multiplier,
    formatAmount,
  }
}
