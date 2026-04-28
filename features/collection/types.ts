export interface SubArc {
  value: number
  colors: string[]
  label: string
}

export interface CollectionData {
  label: string
  value: number
  colors: string[]
  current: number
  target: number
  unit: string
  subArcs?: SubArc[]
}

export interface CircleProgressProps {
  data: CollectionData
  index: number
}
