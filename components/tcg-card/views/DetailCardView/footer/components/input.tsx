
import { useState } from 'react';
import {
  TextField,
  TextFieldProps
} from 'react-native-ui-lib';

// helper
type Replace<T, R> = Omit<T, keyof R> & R

type CleanInputProps<T> = Omit<
  Replace<T, { hint?: string; floatingPlaceholderStyle: FPStyle }>,
  'ref'
>
export type FPStyle = NonNullable<TextFieldProps['floatingPlaceholderStyle']> // i.e., a TextStyle-like shape

export type CreateCollectionInputProps<T> = Omit<CleanInputProps<T>, 'floatingPlaceholderStyle'> & {
  // your function returns exactly what TextField expects for this prop
  floatingPlaceholderStyle?: (hasInput: boolean) => FPStyle
  placeholder?: string
}

export const CreateCollectionInput = ({
  floatingPlaceholderStyle,
  placeholder,
  onChangeText,
  ...props
}: CreateCollectionInputProps<TextFieldProps>) => {
  const [hasInput, setHasInput] = useState(false)

  return (
    <TextField
      placeholder={placeholder}
      onChangeText={(text) => {
        setHasInput(text.length > 0)
        onChangeText?.(text)
      }}
      floatingPlaceholderStyle={
        floatingPlaceholderStyle ? floatingPlaceholderStyle(hasInput) : undefined
      }
      maxLength={60}
      {...props}
    />
  )
}