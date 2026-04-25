import { useMemo } from 'react'
import { fmtAxisValue, roundToNiceCents } from '../helpers'
import { NumericalFields } from '../ui/types'

export type AxisBreak = { normLow: number; normHigh: number; label: string }

/**
 * When series have extreme value variance (e.g. $4k vs $1.99), a single linear
 * y-axis compresses the low-value series to < 1% of chart height, making variation
 * invisible. This hook detects "value clusters" (groups of series separated by ≥5×
 * in magnitude) and produces a piecewise-linear normalisation that gives each cluster
 * equal pixel space. When no break is needed it falls back to the raw domain.
 */
export function useAxisTransform<T extends Record<string, unknown>>(
  data: T[] | undefined,
  yKeys: readonly (keyof NumericalFields<T>)[]
): {
  renderData: T[] | undefined
  renderYDomain: [number, number] | undefined
  axisBreaks: AxisBreak[]
  valueDenorm: (n: number) => number
  valueNorm: (v: number) => number
  normClusterRanges?: [number, number][]
  /** Actual data [min, max] in raw value units for each cluster (before $0 anchor). */
  clusterDataRanges?: [number, number][]
} {
  return useMemo(() => {
    const noTransform = {
      renderData: data,
      renderYDomain: undefined,
      axisBreaks: [],
      valueDenorm: (v: number) => v,
      valueNorm: (v: number) => v,
      clusterDataRanges: undefined,
    }
    if (!data?.length || yKeys.length < 2) return noTransform

    const seriesRanges = yKeys
      .map((k) => {
        const vals = data.flatMap((d) => {
          const v = d[k as keyof T]
          return typeof v === 'number' && v > 0 ? [v] : []
        })
        if (!vals.length) return null
        const min = Math.min(...vals)
        const max = Math.max(...vals)
        return { min, max, mid: (min + max) / 2 }
      })
      .filter(Boolean) as { min: number; max: number; mid: number }[]

    if (seriesRanges.length < 2) return noTransform

    seriesRanges.sort((a, b) => a.mid - b.mid)

    const VALUE_BREAK_RATIO = 5
    type VCluster = { min: number; max: number }
    const valueClusters: VCluster[] = []
    let ci = 0
    while (ci < seriesRanges.length) {
      let cMin = seriesRanges[ci].min
      let cMax = seriesRanges[ci].max
      let cj = ci + 1
      while (
        cj < seriesRanges.length &&
        seriesRanges[cj].min / Math.max(cMax, 1) < VALUE_BREAK_RATIO
      ) {
        cMin = Math.min(cMin, seriesRanges[cj].min)
        cMax = Math.max(cMax, seriesRanges[cj].max)
        cj++
      }
      valueClusters.push({ min: cMin, max: cMax })
      ci = cj
    }

    if (valueClusters.length < 2) return noTransform

    const realClusterMins = valueClusters.map((vc) => vc.min)

    // Anchor the lowest cluster to $0 so the y-axis baseline always reads "$0".
    valueClusters[0].min = 0

    const BREAK_SHARE = 0.2
    const CLUSTER_INNER_PAD_FRAC = 0.15
    const clusterShare = (1 - (valueClusters.length - 1) * BREAK_SHARE) / valueClusters.length
    const pad = clusterShare * CLUSTER_INNER_PAD_FRAC
    const lastIdx = valueClusters.length - 1

    type NCluster = {
      cluster: VCluster
      normMin: number
      normMax: number
      dataNormMin: number
      dataNormMax: number
    }
    const normClusters: NCluster[] = []
    let cursor = 0
    for (let i = 0; i < valueClusters.length; i++) {
      const nMin = cursor
      const nMax = cursor + clusterShare
      normClusters.push({
        cluster: valueClusters[i],
        normMin: nMin,
        normMax: nMax,
        dataNormMin: i === 0 ? nMin : nMin + pad,
        dataNormMax: i === lastIdx ? nMax : nMax - pad,
      })
      cursor += clusterShare + (i < lastIdx ? BREAK_SHARE : 0)
    }

    const normalize = (v: number): number => {
      for (const { cluster, dataNormMin, dataNormMax } of normClusters) {
        if (v >= cluster.min * 0.95 - 1 && v <= cluster.max * 1.05 + 1) {
          const spread = cluster.max - cluster.min || 1
          return dataNormMin + ((v - cluster.min) / spread) * (dataNormMax - dataNormMin)
        }
      }
      let best = normClusters[0]
      let bestD = Infinity
      for (const nc of normClusters) {
        const d = Math.abs(v - (nc.cluster.min + nc.cluster.max) / 2)
        if (d < bestD) {
          bestD = d
          best = nc
        }
      }
      const spread = best.cluster.max - best.cluster.min || 1
      return (
        best.dataNormMin + ((v - best.cluster.min) / spread) * (best.dataNormMax - best.dataNormMin)
      )
    }

    const denormalize = (n: number): number => {
      for (const { cluster, normMin, normMax, dataNormMin, dataNormMax } of normClusters) {
        if (n >= normMin - 0.001 && n <= normMax + 0.001) {
          const spread = cluster.max - cluster.min
          return cluster.min + ((n - dataNormMin) / (dataNormMax - dataNormMin || 1)) * spread
        }
      }
      return n
    }

    const renderData = (data as Record<string, unknown>[]).map((point) => {
      const next = { ...point }
      for (const k of yKeys as string[]) {
        const v = next[k]
        if (typeof v === 'number' && v > 0) next[k] = normalize(v)
      }
      return next
    }) as T[]

    const axisBreaks: AxisBreak[] = normClusters.slice(0, -1).map((nc, i) => ({
      normLow: nc.normMax,
      normHigh: normClusters[i + 1].normMin,
      label: `${fmtAxisValue(roundToNiceCents(nc.cluster.max, 'ceil'))} — ${fmtAxisValue(roundToNiceCents(normClusters[i + 1].cluster.min, 'floor'))}`,
    }))

    const normClusterRanges = normClusters.map((nc) => [nc.normMin, nc.normMax] as [number, number])
    const clusterDataRanges = valueClusters.map(
      (vc, i) => [realClusterMins[i], vc.max] as [number, number]
    )

    return {
      renderData,
      renderYDomain: [0, 1],
      axisBreaks,
      valueDenorm: denormalize,
      valueNorm: normalize,
      normClusterRanges,
      clusterDataRanges,
    }
  }, [data, yKeys])
}
