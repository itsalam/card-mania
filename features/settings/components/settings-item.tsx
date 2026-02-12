// import { useToast } from '@/components/Toast'
// import { Text } from '@/components/ui/text'
// import { ToggleGroup, ToggleGroupIcon, ToggleGroupItem } from '@/components/ui/toggle-group'
// import { ChevronRight } from 'lucide-react-native'
// import { ReactNode, useEffect, useRef, useState } from 'react'
// import { View } from 'react-native'
// import { Colors } from 'react-native-ui-lib'
// import { useProfileSettings } from '../provider'
// import { SettingsItemData } from '../types'

// export function SettingsItem({
//   itemKey,
//   data,
//   path,
// }: {
//   itemKey: string
//   data: SettingsItemData
//   children?: ReactNode
//   path: string[]
// }) {
//   const themeMode = useSetting("themeMode");
//   const systemScheme = useTierValue("systemColorScheme", "system");
//   const toast = useToast()
//   const { type, label, Icon, value, ...rest } = data

//   const safeValue = useRef(value)
//   const [immediateSetting, setImmediateSetting] = useState(value)

//   useEffect(() => {
//     setImmediateSetting(value)
//   }, [value])

//   const onSettingsChange = (v?: string) => {
//     setImmediateSetting(v)
//     updateSettings([...path, itemKey], v ?? null, type)
//       .catch((e) => {
//         toast.showToast({ message: e })
//         setImmediateSetting(safeValue.current)
//       })
//       .then(() => {
//         safeValue.current = v
//       })
//   }

//   const RightElement = () => {
//     switch (type) {
//       case 'page':
//         return (
//           <ChevronRight
//             style={{
//               marginLeft: 'auto',
//               marginRight: 12,
//               alignSelf: 'flex-end',
//             }}
//           />
//         )
//       case 'toggle':
//         const { values } = data
//         return (
//           <ToggleGroup
//             value={String(immediateSetting)}
//             onValueChange={onSettingsChange}
//             variant="outline"
//             type="single"
//           >
//             {values.map(({ Icon, value }) => {
//               return (
//                 <ToggleGroupItem
//                   value={value}
//                   aria-label="Toggle bold"
//                   style={{ flexDirection: 'row' }}
//                 >
//                   <ToggleGroupIcon icon={Icon} size={20} />
//                   {/* <Text>{value[0].toLocaleLowerCase() + value.slice(1)}</Text> */}
//                 </ToggleGroupItem>
//               )
//             })}
//           </ToggleGroup>
//         )
//       default:
//         return <></>
//     }
//   }
//   return (
//     <View
//       style={{
//         alignItems: 'center',
//         display: 'flex',
//         flexDirection: 'row',
//         gap: 4,
//         paddingVertical: 10,
//       }}
//     >
//       <Icon size={26} color={Colors.$iconDefault} />
//       <Text variant={'large'} style={{ fontSize: 18 }}>
//         {label}
//       </Text>
//       <View
//         style={{
//           marginLeft: 'auto',
//           marginRight: 12,
//           alignSelf: 'flex-end',
//         }}
//       >
//         <RightElement />
//       </View>
//     </View>
//   )
// }
