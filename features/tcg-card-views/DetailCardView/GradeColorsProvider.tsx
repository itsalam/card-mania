import { gradientColors } from '@/components/graphs/helpers'
import React, { createContext, useContext, useMemo } from 'react'

const GradeColorsContext = createContext<Record<string, string>>({})

export const GradeColorsProvider = ({
  grades,
  colorRange,
  children,
}: {
  grades: string[]
  colorRange: [string, string]
  children: React.ReactNode
}) => {
  const colorMap = useMemo(() => {
    if (!grades.length) return {}
    const colors = gradientColors(colorRange[0], colorRange[1], grades.length)
    return Object.fromEntries(grades.map((g, i) => [g, colors[i]]))
  }, [grades, colorRange])

  return <GradeColorsContext.Provider value={colorMap}>{children}</GradeColorsContext.Provider>
}

export const useGradeColors = () => useContext(GradeColorsContext)
