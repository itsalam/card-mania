import { TextClassContext } from '@/components/ui/text'
import { cn } from '@/lib/utils/index'
import { cva, type VariantProps } from 'class-variance-authority'
import {
  Platform,
  Pressable,
  TouchableOpacity,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { Colors } from 'react-native-ui-lib'

const buttonVariants = cva(
  cn(
    'group shrink-0 flex-row items-center justify-center gap-2 rounded-md shadow-none',
    Platform.select({
      web: "whitespace-nowrap outline-none transition-all focus-visible:ring-[3px] disabled:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
    })
  ),
  {
    variants: {
      variant: {
        default: cn('shadow-sm', Platform.select({ web: '' })),
        primary: '',
        destructive: cn('shadow-sm'),
        outline: cn('border shadow-sm'),
        secondary: cn('shadow-sm', Platform.select({ web: '' })),
        ghost: cn('', Platform.select({ web: '' })),
        link: '',
      },
      size: {
        default: cn('h-10 px-4 py-2 sm:h-9', Platform.select({ web: 'has-[>svg]:px-3' })),
        sm: cn('h-9 gap-1.5 rounded-md px-3 sm:h-8', Platform.select({ web: 'has-[>svg]:px-2.5' })),
        lg: cn('h-11 rounded-md px-6 sm:h-10', Platform.select({ web: 'has-[>svg]:px-4' })),
        icon: 'h-11 w-11 sm:h-9 sm:w-9 rounded-full',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

const buttonTextVariants = cva(
  cn('text-sm font-medium', Platform.select({ web: 'pointer-events-none transition-colors' })),
  {
    variants: {
      variant: {
        primary: '',
        default: '',
        destructive: '',
        outline: cn('', Platform.select({ web: '' })),
        secondary: '',
        ghost: '',
        link: cn(
          'group-active:underline',
          Platform.select({ web: 'underline-offset-4 hover:underline group-hover:underline' })
        ),
      },
      size: {
        default: '',
        sm: '',
        lg: '',
        icon: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

type ButtonProps = React.ComponentProps<typeof Pressable> &
  React.RefAttributes<typeof Pressable> &
  VariantProps<typeof buttonVariants>

type ButtonVariantArgs = Parameters<typeof buttonVariants>[0]

const getButtonColorStyles = ({ variant = 'default' }: ButtonVariantArgs = {}) => {
  const containerStyle: StyleProp<ViewStyle> = {}

  switch (variant) {
    case 'primary':
      containerStyle.backgroundColor = Colors.$backgroundPrimaryHeavy
      break
    case 'destructive':
      containerStyle.backgroundColor = Colors.$backgroundWarningHeavy
      break
    case 'outline':
      containerStyle.backgroundColor = Colors.$backgroundDefault
      containerStyle.borderColor = Colors.$outlineNeutral
      containerStyle.borderWidth = 1
      break
    case 'secondary':
      containerStyle.backgroundColor = Colors.$backgroundNeutral
      break
    case 'ghost':
    case 'link':
      containerStyle.backgroundColor = 'transparent'
      break
    default:
      containerStyle.backgroundColor = Colors.$backgroundElevatedLight
      break
  }

  return { containerStyle }
}

const getButtonTextColorStyles = ({ variant = 'default' }: ButtonVariantArgs = {}) => {
  const textStyle: StyleProp<TextStyle> = {}

  switch (variant) {
    case 'primary':
      textStyle.color = Colors.$textDefault
    case 'destructive':
    case 'default':
      textStyle.color = Colors.$textDefault
      break
    case 'outline':
    case 'ghost':
    case 'link':
      textStyle.color = Colors.$textDefault
      break
    case 'secondary':
      textStyle.color = Colors.$textPrimary
      break
    default:
      textStyle.color = Colors.$textDefault
      break
  }

  return { textStyle }
}

function Button({ className, variant, size, style, ...props }: ButtonProps) {
  return (
    <TextClassContext.Provider value={buttonTextVariants({ variant, size })}>
      <TouchableOpacity
        className={cn(props.disabled && 'opacity-50', buttonVariants({ variant, size }), className)}
        role="button"
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            alignContent: 'center',
          },
          getButtonColorStyles({ variant, size }).containerStyle,
          style,
        ]}
        {...props}
      />
    </TextClassContext.Provider>
  )
}

export {
  Button,
  buttonTextVariants,
  buttonVariants,
  getButtonColorStyles,
  getButtonTextColorStyles,
}
export type { ButtonProps }
