'use client'
import { cva, VariantProps } from 'class-variance-authority'
import { cssInterop } from 'nativewind'
import React from 'react'
import { StyleProp } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { TextField } from './base-input'
import { InputProps } from './types'

cssInterop(TextField, {
  className: {
    target: 'style',
  },
})

export const inputStyle = cva(
  'border-background-300 flex-row overflow-hidden content-center data-[hover=true]:border-outline-400 data-[focus=true]:border-primary-700 data-[focus=true]:hover:border-primary-700 data-[disabled=true]:opacity-40 data-[disabled=true]:hover:border-background-300 items-center',
  {
    variants: {
      size: {
        search: 'h-16',
        '2xl': 'h-14',
        xl: 'h-12',
        lg: 'h-11',
        md: 'h-10',
        sm: 'h-9',
      },

      variant: {
        ghost: 'rounded-none',
        underlined:
          'rounded-none border-b data-[invalid=true]:border-b-2 data-[invalid=true]:border-error-700 data-[invalid=true]:hover:border-error-700 data-[invalid=true]:data-[focus=true]:border-error-700 data-[invalid=true]:data-[focus=true]:hover:border-error-700 data-[invalid=true]:data-[disabled=true]:hover:border-error-700',

        outline:
          'rounded data-[invalid=true]:border-error-700 data-[invalid=true]:hover:border-error-700 data-[invalid=true]:data-[focus=true]:border-error-700 data-[invalid=true]:data-[focus=true]:hover:border-error-700 data-[invalid=true]:data-[disabled=true]:hover:border-error-700 data-[focus=true]:web:ring-1 data-[focus=true]:web:ring-inset data-[focus=true]:web:ring-indicator-primary data-[invalid=true]:web:ring-1 data-[invalid=true]:web:ring-inset data-[invalid=true]:web:ring-indicator-error data-[invalid=true]:data-[focus=true]:hover:web:ring-1 data-[invalid=true]:data-[focus=true]:hover:web:ring-inset data-[invalid=true]:data-[focus=true]:hover:web:ring-indicator-error data-[invalid=true]:data-[disabled=true]:hover:web:ring-1 data-[invalid=true]:data-[disabled=true]:hover:web:ring-inset data-[invalid=true]:data-[disabled=true]:hover:web:ring-indicator-error',

        rounded:
          'rounded-full data-[invalid=true]:border-error-700 data-[invalid=true]:hover:border-error-700 data-[invalid=true]:data-[focus=true]:border-error-700 data-[invalid=true]:data-[focus=true]:hover:border-error-700 data-[invalid=true]:data-[disabled=true]:hover:border-error-700 data-[focus=true]:web:ring-1 data-[focus=true]:web:ring-inset data-[focus=true]:web:ring-indicator-primary data-[invalid=true]:web:ring-1 data-[invalid=true]:web:ring-inset data-[invalid=true]:web:ring-indicator-error data-[invalid=true]:data-[focus=true]:hover:web:ring-1 data-[invalid=true]:data-[focus=true]:hover:web:ring-inset data-[invalid=true]:data-[focus=true]:hover:web:ring-indicator-error data-[invalid=true]:data-[disabled=true]:hover:web:ring-1 data-[invalid=true]:data-[disabled=true]:hover:web:ring-inset data-[invalid=true]:data-[disabled=true]:hover:web:ring-indicator-error',
      },
    },
  }
)

export const inputStyleSheet = (variants: Parameters<typeof inputStyle>[0]) => {
  const variant = variants?.variant
  const containerStyle: StyleProp<any> = {}

  if (variant === 'outline' || variant === 'rounded') {
    containerStyle.borderWidth = 1
    containerStyle.borderColor = Colors.$iconNeutral
  }

  return { containerStyle }
}

type InputVariantConfiguration = VariantProps<typeof inputStyle>

export type InputVariantProps = InputVariantConfiguration
type IInputProps = Omit<InputProps, 'variant' | 'size'> & InputVariantProps

const Input = React.forwardRef<React.ComponentRef<typeof TextField>, IInputProps>(
  ({ className, variant = 'outline', size = 'md', style, ...props }, ref) => {
    // @ts-ignore
    return (
      <TextField
        ref={ref}
        {...props}
        style={[inputStyleSheet({ variant, size }).containerStyle, style]}
        className={inputStyle({ variant, size, class: className })}
      />
    )
  }
)

Input.displayName = 'Input'

export { Input }
