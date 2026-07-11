import { TabRow } from 'card-mania'

export const TwoOptions = () => (
  <TabRow
    options={[
      { value: 'chart', label: 'Chart' },
      { value: 'sales', label: 'Sales' },
    ]}
  />
)

export const FourOptions = () => (
  <TabRow
    options={[
      { value: '1d', label: '1D' },
      { value: '1w', label: '1W' },
      { value: '1m', label: '1M' },
      { value: '1y', label: '1Y' },
    ]}
    startingIdx={1}
  />
)
