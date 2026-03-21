import { useCombinedRefs } from '@/components/hooks/useCombinedRefs'
import _isUndefined from 'lodash/isUndefined'
import { forwardRef, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { TextInputChangeEvent } from 'react-native'
import { Assets, ChipProps, ChipsInputChipProps, Constants } from 'react-native-ui-lib'
import { ChipsInputChangeReason } from 'react-native-ui-lib/src/components/chipsInput'
import { useDidUpdate } from 'react-native-ui-lib/src/hooks'
import { Badge, BaseBadgeProps } from '../badge'
import { Input, TextField, TextFieldHandle } from './base-input'
import { FieldContext, FieldStore } from './provider'
import { InputProps } from './types'

export type ChipsInputProps = Omit<InputProps, 'onChange'> & {
  /**
   * Inital Chip items to render in the input
   */
  chips?: ChipProps[] | undefined
  /**
   * A default set of chip props to pass to all chips
   */
  defaultChipProps?: ChipProps | undefined
  /**
   * A default set of chip props to pass to all invalid chips
   */
  invalidChipProps?: ChipProps | undefined
  /**
   * Change callback for when chips changed (either added or removed)
   */
  onChange?:
    | ((
        chips: ChipsInputChipProps[],
        changeReason: ChipsInputChangeReason,
        updatedChip: ChipProps
      ) => void)
    | undefined
  /**
   * Inner onchange for input component
   */
  innerOnChange?: ((e: TextInputChangeEvent) => void) | undefined
  /**
   * Flag to ensure each tag's label is unique
   */
  unique?: boolean
  /**
   * Maximum chips
   */
  maxChips?: number | undefined
}

export const BadgeInput = forwardRef<TextFieldHandle, ChipsInputProps>((props, refToForward) => {
  // Deep merge BaseBadgeProps and defaultChipProps
  const {
    chips = [],
    defaultChipProps,
    invalidChipProps,
    leadingAccessory,
    maxChips,
    onChange,
    ...inputProps
  } = props
  return (
    <TextField {...inputProps} ref={refToForward}>
      {({ onChange: innerOnChange, ...innerProps }, ref) => (
        <BadgeInputInner ref={ref} {...{ ...innerProps, ...props, innerOnChange, onChange }} />
      )}
    </TextField>
  )
})

BadgeInput.displayName = 'BadgeInput'

export const BadgeInputInner = forwardRef<TextFieldHandle, ChipsInputProps>(
  (
    {
      chips = [],
      defaultChipProps,
      invalidChipProps,
      leadingAccessory,
      onChange,
      innerOnChange,
      maxChips,
      validate,
      onChangeText,
      unique,
      ...props
    },
    refToForward
  ) => {
    // Deep merge BaseBadgeProps and defaultChipProps
    const mainFieldRef = useRef(null)
    const context = useContext<FieldStore>(FieldContext)
    const [markedForRemoval, setMarkedForRemoval] = useState<number | undefined>(undefined)
    const fieldRef = useCombinedRefs(refToForward, mainFieldRef)
    const fieldValue = useMemo(() => context.value, [context.value])
    const [currentChips, setCurrentChips] = useState(chips)

    const addChip = useCallback(() => {
      const reachedMaximum = maxChips && currentChips?.length >= maxChips
      if (unique) {
        const shouldBeUnique = Boolean(
          currentChips.find((c) => {
            c.label === fieldValue
          })
        )
        if (shouldBeUnique) return
      }
      if (fieldValue && !reachedMaximum) {
        const newChip = {
          label: fieldValue,
        }
        setMarkedForRemoval(undefined)
        fieldRef.current?.clear?.()
        // fieldValue.current = ''
        /* NOTE: Delay change event to give clear field time to complete and avoid a flickering */

        setTimeout(() => {
          onChange?.([...currentChips, newChip], ChipsInputChangeReason.Added, newChip)
          fieldRef.current?.focus()
        }, 0)
        setCurrentChips([...currentChips, newChip])
        context.onChangeText?.('')
      }
      fieldRef.current?.focus()
    }, [onChange, currentChips, maxChips])

    const removeMarkedChip = useCallback(() => {
      if (!_isUndefined(markedForRemoval)) {
        const removedChip = currentChips?.splice(markedForRemoval, 1)
        onChange?.([...currentChips], ChipsInputChangeReason.Removed, removedChip?.[0])
        setCurrentChips(currentChips)
        setMarkedForRemoval(undefined)
      }
    }, [currentChips, markedForRemoval, onChange])

    const onChipPress = useCallback<NonNullable<ChipProps['onPress']>>(
      ({ customValue: index }) => {
        const selectedChip = currentChips[index]
        selectedChip?.onPress?.()
        setMarkedForRemoval(index)
      },
      [currentChips]
    )

    const onChangeTextCb = useCallback<NonNullable<InputProps['onChangeText']>>(
      (value) => {
        // fieldValue.current = value
        if (!_isUndefined(markedForRemoval)) {
          setMarkedForRemoval(undefined)
        }
        onChangeText?.(value)
      },
      [onChangeText, markedForRemoval]
    )

    const onKeyPress = useCallback<NonNullable<InputProps['onKeyPress']>>(
      (event) => {
        props.onKeyPress?.(event)
        const keyCode = event?.nativeEvent?.key
        const pressedBackspace = keyCode === Constants.backspaceKey
        if (pressedBackspace && !fieldValue && currentChips.length > 0) {
          if (_isUndefined(markedForRemoval) || markedForRemoval !== currentChips.length - 1) {
            setMarkedForRemoval(currentChips.length - 1)
          } else {
            removeMarkedChip()
          }
        }
      },
      [currentChips, props.onKeyPress, markedForRemoval, removeMarkedChip]
    )

    const renderBadge = (props: {
      index: number
      chip: ChipProps & { invalid?: boolean }
      isMarkedForRemoval: boolean
    }) => {
      const { index, chip, isMarkedForRemoval } = props
      const { iconStyle, containerStyle, labelStyle, ...defaultProps } = defaultChipProps || {}
      return (
        <Badge
          key={index}
          customValue={index}
          dismissIcon={Assets.internal.icons.xSmall}
          recorderTag={'mask'}
          iconStyle={[BaseBadgeProps.iconStyle, iconStyle]}
          containerStyle={[
            BaseBadgeProps.containerStyle,
            containerStyle,
            {
              marginTop: 0,
            },
          ]}
          labelStyle={[BaseBadgeProps.labelStyle, labelStyle]}
          {...defaultProps}
          {...(chip.invalid ? invalidChipProps : undefined)}
          {...chip}
          onPress={onChipPress}
          onDismiss={isMarkedForRemoval ? removeMarkedChip : undefined}
        />
      )
    }
    const chipList = useMemo(() => {
      return (
        <>
          {leadingAccessory}
          {chips.map((chip, index) => {
            const isMarkedForRemoval = index === markedForRemoval
            if (!maxChips || index < maxChips) {
              return renderBadge({
                index,
                chip,
                isMarkedForRemoval,
              })
            }
          })}
        </>
      )
    }, [
      currentChips,
      leadingAccessory,
      defaultChipProps,
      removeMarkedChip,
      markedForRemoval,
      maxChips,
    ])

    const isRequired = useMemo(() => {
      if (!validate) {
        return false
      }
      const inputValidators = Array.isArray(validate) ? validate : [validate]
      return inputValidators.includes('required')
    }, [validate])
    const requiredValidator = useCallback(() => {
      return !isRequired || (currentChips?.length ?? 0) > 0
    }, [isRequired, currentChips])

    const _validate = useMemo(() => {
      if (!validate) {
        return undefined
      } else if (isRequired) {
        const inputValidators = Array.isArray(validate) ? validate : [validate]
        return inputValidators.map((validator) =>
          validator === 'required' ? requiredValidator : validator
        )
      } else {
        return validate
      }
    }, [validate, isRequired, requiredValidator])

    useDidUpdate(() => {
      if (props.validateOnChange) {
        fieldRef.current?.validate?.()
      }
    }, [currentChips, props.validateOnChange])

    return (
      <Input
        {...props}
        ref={fieldRef}
        floatingPlaceholder
        leadingAccessory={chipList}
        onChangeText={onChangeTextCb}
        onSubmitEditing={addChip}
        onKeyPress={onKeyPress}
        onChange={innerOnChange}
        accessibilityHint={
          props.editable ? 'press keyboard delete button to remove last tag' : undefined
        }
        validate={_validate}
        forceFloat={chips.length > 0}
      />
    )
  }
)

BadgeInputInner.displayName = 'BadgeInputInner'
