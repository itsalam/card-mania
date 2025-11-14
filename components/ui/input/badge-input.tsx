import { useCombinedRefs } from '@/components/hooks/useCombinedRefs'
import _isUndefined from 'lodash/isUndefined'
import { forwardRef, useCallback, useContext, useMemo, useState } from 'react'
import { Assets, ChipProps, ChipsInputChipProps, Constants } from 'react-native-ui-lib'
import { ChipsInputChangeReason } from 'react-native-ui-lib/src/components/chipsInput'
import { useDidUpdate } from 'react-native-ui-lib/src/hooks'
import { Badge, BaseBadgeProps } from '../badge'
import { Input, TextField, TextFieldHandle } from './base-input'
import { FieldContext, FieldStore } from './provider'
import { InputProps } from './types'

export type ChipsInputProps = InputProps & {
  /**
   * Chip items to render in the input
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
    ...inputProps
  } = props
  return (
    <TextField {...inputProps} ref={refToForward}>
      {(_, ref) => <BadgeInputInner ref={ref} {...props} />}
    </TextField>
  )
})

export const BadgeInputInner = forwardRef<TextFieldHandle, ChipsInputProps>(
  (
    {
      chips = [],
      defaultChipProps,
      invalidChipProps,
      leadingAccessory,
      onChange,
      maxChips,
      validate,
      onChangeText,
      ...props
    },
    refToForward
  ) => {
    // Deep merge BaseBadgeProps and defaultChipProps
    const context = useContext<FieldStore>(FieldContext)
    const [markedForRemoval, setMarkedForRemoval] = useState<number | undefined>(undefined)
    const fieldRef = useCombinedRefs(refToForward)
    const fieldValue = useMemo(() => context.value, [context.value])

    const addChip = useCallback(() => {
      const reachedMaximum = maxChips && chips?.length >= maxChips
      if (fieldValue && !reachedMaximum) {
        const newChip = {
          label: fieldValue,
        }
        setMarkedForRemoval(undefined)
        fieldRef.current?.clear?.()
        // fieldValue.current = ''
        /* NOTE: Delay change event to give clear field time to complete and avoid a flickering */
        setTimeout(() => {
          onChange?.([...chips, newChip], ChipsInputChangeReason.Added, newChip)
        }, 0)
      }
    }, [onChange, chips, maxChips])

    const removeMarkedChip = useCallback(() => {
      if (!_isUndefined(markedForRemoval)) {
        const removedChip = chips?.splice(markedForRemoval, 1)
        onChange?.([...chips], ChipsInputChangeReason.Removed, removedChip?.[0])
        setMarkedForRemoval(undefined)
      }
    }, [chips, markedForRemoval, onChange])

    const onChipPress = useCallback<NonNullable<ChipProps['onPress']>>(
      ({ customValue: index }) => {
        const selectedChip = chips[index]
        selectedChip?.onPress?.()
        setMarkedForRemoval(index)
      },
      [chips]
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
        if (pressedBackspace && !fieldValue && chips.length > 0) {
          if (_isUndefined(markedForRemoval) || markedForRemoval !== chips.length - 1) {
            setMarkedForRemoval(chips.length - 1)
          } else {
            removeMarkedChip()
          }
        }
      },
      [chips, props.onKeyPress, markedForRemoval, removeMarkedChip]
    )

    const renderChip = (props: {
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
              return renderChip({
                index,
                chip,
                isMarkedForRemoval,
              })
            }
          })}
        </>
      )
    }, [chips, leadingAccessory, defaultChipProps, removeMarkedChip, markedForRemoval, maxChips])
    const isRequired = useMemo(() => {
      if (!validate) {
        return false
      }
      const inputValidators = Array.isArray(validate) ? validate : [validate]
      return inputValidators.includes('required')
    }, [validate])
    const requiredValidator = useCallback(() => {
      return !isRequired || (chips?.length ?? 0) > 0
    }, [isRequired, chips])
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
    }, [chips, props.validateOnChange])

    return (
      <Input
        {...props}
        ref={fieldRef}
        floatingPlaceholder
        leadingAccessory={chipList}
        onChangeText={onChangeTextCb}
        onSubmitEditing={addChip}
        onKeyPress={onKeyPress}
        accessibilityHint={
          props.editable ? 'press keyboard delete button to remove last tag' : undefined
        }
        validate={_validate}
        forceFloat={chips.length > 0}
      />
    )
  }
)
