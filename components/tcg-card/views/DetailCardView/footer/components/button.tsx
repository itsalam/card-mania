import { LucideIcon, LucideProps } from 'lucide-react-native'
import { JSX } from 'react'
import { SvgProps } from 'react-native-svg'
import { Button, ButtonProps, Colors } from 'react-native-ui-lib'

export const FooterButton = ({
  icon: Icon,
  label,
  onPress,
  highLighted = false,
  iconSource,
  iconProps = {},
  fill = false,
  stroke = true,
  disabled = false,
  children,
  style,
  ...buttonProps
}: ButtonProps & {
  icon?: LucideIcon | ((props: SvgProps) => JSX.Element)
  label: string
  onPress: () => void
  highLighted?: boolean
  fill?: boolean
  stroke?: boolean
  iconProps?: LucideProps & SvgProps
  disabled?: boolean
}) => {
  const outlineColor = highLighted
    ? Colors.$outlinePrimary
    : Colors.rgba(Colors.$outlinePrimary, 0.6)
  const color = highLighted ? Colors.$outlineDefault : Colors.$outlinePrimary
  return (
    <Button
      style={style}
      disabled={disabled}
      className="flex-1 flex flex-row gap-2 justify-between"
      onPress={onPress}
      outline={!highLighted}
      outlineColor={outlineColor}
      outlineWidth={2}
      label={label}
      iconSource={iconSource}
      iconStyle={{ width: 22, height: 22 }}
      {...buttonProps}
    >
      {Icon && (
        <Icon
          height={22}
          width={22}
          strokeWidth={2.5}
          fill={fill ? color : 'transparent'}
          stroke={stroke ? color : 'transparent'}
          style={{ flex: 0 }}
          {...iconProps}
        />
      )}
      {children}
    </Button>
  )
}
