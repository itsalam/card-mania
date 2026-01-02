import { cssInterop } from 'nativewind'
import { useEffect, useState } from 'react'
import { AccessibilityActionEvent, View } from 'react-native'
import {
  asBaseComponent,
  Assets,
  BorderRadiuses,
  Colors,
  NumberInput,
  Button as RNButton,
  View as RNView,
  Shadows,
  Spacings,
  StepperProps,
  Text,
  TextFieldProps,
  Typography,
} from 'react-native-ui-lib'

cssInterop(NumberInput, {
  className: {
    //@ts-ignore
    target: 'style',
  },
})

type NumberTickerProps = TextFieldProps & {
  disabled?: boolean
  className?: string
  fractionDigits?: number
  onChangeNumber?: (value: number) => void
  initialNumber?: number
  min?: number
  max?: number
}

export const NumberTicker = ({
  className,
  containerStyle,
  style,
  fractionDigits,
  initialNumber,
  onChangeNumber,
  margin,
  min,
  max,
  ...props
}: NumberTickerProps) => {
  const [number, setNumber] = useState(initialNumber || 0)
  fractionDigits = fractionDigits ?? 0
  useEffect(() => {
    onChangeNumber && onChangeNumber(number)
  }, [number])

  const onChangeText = (str: string) => {
    let num = Number(Number(str).toFixed(fractionDigits))
    if (isNaN(num)) {
      setNumber(number)
      return
    }
    if (min !== undefined) {
      num = Math.max(num, min)
    }
    if (max !== undefined) {
      num = Math.min(num, max)
    }
    setNumber(num)
  }

  return (
    <View
      style={{
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      className={className}
    >
      <Stepper
        small
        minValue={min}
        maxValue={max}
        onValueChange={onChangeNumber}
        value={initialNumber}
        type="floating"
      />
      {/* <TouchableOpacity
        onPress={() => setNumber(Math.min(number + 1, max ?? Infinity))}
        style={{ marginBottom: 0 }}
        hitSlop={{ top: 10, bottom: 0, left: 10, right: 10 }}
        disabled={number >= (max ?? Infinity)}
      >
        <ChevronUp
          size={24}
          color={number >= (max ?? Infinity) ? Colors.$iconDisabled : Colors.$iconDefault}
        />
      </TouchableOpacity>
      <TextField
        {...props}
        containerStyle={[
          containerStyle,
          {
            borderWidth: 2,
            borderColor: Colors.$outlineDefault,
            borderRadius: BorderRadiuses.br20,
            minWidth: 44,
            padding: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          },
        ]}
        style={[
          style,
          {
            fontSize: 20,
          },
        ]}
        onChangeText={onChangeText}
        value={String(number)}
        keyboardType="numeric"
        centered
      />
      <TouchableOpacity
        onPress={() => setNumber(Math.max(number - 1, min ?? -Infinity))}
        style={{ marginTop: 4 }}
        hitSlop={{ top: 0, bottom: 10, left: 10, right: 10 }}
        disabled={number <= (min ?? -Infinity)}
      >
        <ChevronDown
          size={24}
          color={number <= (min ?? -Infinity) ? Colors.$iconDisabled : Colors.$iconDefault}
        />
      </TouchableOpacity> */}
    </View>
  )
}

type StepperState = {
  currentValue: number
}

import _isUndefined from 'lodash/isUndefined'
import React, { PureComponent } from 'react'
import { AccessibilityInfo, StyleSheet } from 'react-native'

enum ActionType {
  MINUS = 'minus',
  PLUS = 'plus',
}
const DEFAULT_STEP = 1
/**
 * @description: A stepper component
 * @example: https://github.com/wix/react-native-ui-lib/blob/master/demo/src/screens/componentScreens/StepperScreen.js
 */
class Stepper extends PureComponent<StepperProps, StepperState> {
  constructor(props: StepperProps) {
    super(props)
    const { value, minValue = 0, maxValue = 1, testID } = props
    let initialValue = 0
    if (minValue) {
      initialValue = minValue
    }
    if (value !== undefined) {
      initialValue = value
    }
    this.state = {
      currentValue: initialValue,
    }
    if (initialValue < minValue) {
      console.warn(
        `Stepper: ${testID}'s minimum value: ${minValue} is greater than current value: ${initialValue}`
      )
    }
    if (initialValue > maxValue) {
      console.warn(
        `Stepper: ${testID}'s maximum value: ${maxValue} is less than current value: ${initialValue}`
      )
    }
    if (minValue > maxValue) {
      console.warn(
        `Stepper: ${testID}'s minimum value: ${minValue} is greater than the maximum value: ${maxValue}`
      )
    }
  }
  static getDerivedStateFromProps(nextProps: StepperProps, prevState: StepperState) {
    if (!_isUndefined(nextProps.value) && prevState.currentValue !== nextProps.value) {
      return {
        currentValue: nextProps.value,
      }
    }
    return null
  }
  getAccessibilityProps() {
    const { currentValue } = this.state
    const { accessibilityLabel } = this.props
    const labelSuffix = `value = ${currentValue}`
    return {
      accessibilityLabel: accessibilityLabel
        ? `${accessibilityLabel}, ${labelSuffix}`
        : `Stepper, ${labelSuffix}`,
      accessible: true,
      accessibilityRole: 'adjustable',
      accessibilityActions: [
        {
          name: 'decrement',
        },
        {
          name: 'increment',
        },
      ],
      onAccessibilityAction: this.onAccessibilityAction,
    }
  }
  onAccessibilityAction = (event: AccessibilityActionEvent) => {
    const { currentValue } = this.state
    const { step = DEFAULT_STEP } = this.props
    const eventMsgContext = event.nativeEvent.actionName === 'decrement' ? 'Minimum' : 'Maximum'
    const stepperLimitMsg = `${eventMsgContext} stepper value, ${currentValue}, reached`
    switch (event.nativeEvent.actionName) {
      case 'decrement':
        this.accessibilityActionHandler(ActionType.MINUS, currentValue - step, stepperLimitMsg)
        break
      case 'increment':
        this.accessibilityActionHandler(ActionType.PLUS, currentValue + step, stepperLimitMsg)
        break
      default:
        break
    }
  }
  accessibilityActionHandler(
    actionType: ActionType,
    newStepperValue: number,
    actionLimitMsg: string
  ) {
    if (this.allowStepChange(actionType)) {
      this.handleStepChange(actionType)
      AccessibilityInfo.announceForAccessibility?.(newStepperValue.toString())
    } else {
      AccessibilityInfo.announceForAccessibility?.(actionLimitMsg)
    }
  }
  allowStepChange(actionType: ActionType) {
    const { minValue, maxValue } = this.props
    const { currentValue } = this.state
    if (actionType === ActionType.PLUS) {
      return maxValue === undefined || currentValue < maxValue
    }
    if (actionType === ActionType.MINUS) {
      return minValue === undefined || currentValue > minValue
    }
  }
  handleStepChange(actionType: ActionType) {
    const { testID, step = DEFAULT_STEP } = this.props
    const { currentValue } = this.state
    let newCurrent = currentValue
    if (actionType === ActionType.MINUS) {
      newCurrent = currentValue - step
    } else {
      newCurrent = currentValue + step
    }
    this.setState({
      currentValue: newCurrent,
    })
    this.props.onValueChange?.(newCurrent, testID)
  }
  renderButton(actionType: ActionType) {
    const { type, disabled, small, testID } = this.props
    const allowStepChange = this.allowStepChange(actionType)
    const isFloatingStepper = type === 'floating'
    const minusButton = isFloatingStepper
      ? Assets.internal.icons.minusSmall
      : small
      ? Assets.internal.icons.minusOutlineSmall
      : Assets.internal.icons.minusOutline
    const plusButton = isFloatingStepper
      ? Assets.internal.icons.plusSmall
      : small
      ? Assets.internal.icons.plusOutlineSmall
      : Assets.internal.icons.plusOutline
    return (
      <RNButton
        link
        color={isFloatingStepper ? Colors.$iconDefault : undefined}
        iconSource={actionType === ActionType.MINUS ? minusButton : plusButton}
        disabled={disabled || !allowStepChange}
        onPress={() => this.handleStepChange(actionType)}
        testID={actionType === ActionType.MINUS ? `${testID}.minusStep` : `${testID}.plusStep`}
      />
    )
  }
  render() {
    const { type, disabled, testID } = this.props
    const { currentValue } = this.state
    return (
      <RNView
        row
        centerV
        {...this.getAccessibilityProps()}
        style={type === 'floating' && styles.containerFloating}
      >
        {this.renderButton(ActionType.MINUS)}
        <Text
          $textDefault
          $textDisabled={disabled}
          style={[
            Typography.text70M,
            type === 'floating' ? styles.textFloating : styles.textDefault,
          ]}
          testID={`${testID}.currentValue`}
          recorderTag={'unmask'}
        >
          {currentValue}
        </Text>
        {this.renderButton(ActionType.PLUS)}
      </RNView>
    )
  }
}
const styles = StyleSheet.create({
  containerFloating: {
    borderRadius: BorderRadiuses.br100,
    backgroundColor: Colors.$backgroundElevated,
    borderWidth: 1,
    borderColor: Colors.$outlineDefault,
    paddingHorizontal: Spacings.s3,
    paddingVertical: Spacings.s1,
    ...Shadows.sh10.bottom,
  },
  textDefault: {
    marginHorizontal: Spacings.s5,
  },
  textFloating: {
    marginHorizontal: Spacings.s2,
    minWidth: Spacings.s6,
    textAlign: 'center',
  },
})
export default asBaseComponent(Stepper)
