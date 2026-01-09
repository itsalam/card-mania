import { TextField } from '@/components/ui/input/base-input'
import { InputProps } from '@/components/ui/input/types'

export const CreateCollectionInput = ({ ...props }: InputProps) => {
  return <TextField maxLength={60} {...props} />
}
