export interface CollectionData {
  label: string
  value: number
  colors: string[]
  current: number
  target: number
  unit: string
}

export interface CircleProgressProps {
  data: CollectionData
  index: number
}
