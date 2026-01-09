import { cn } from '@/lib/utils/index'
import * as SwitchPrimitives from '@rn-primitives/switch'
import { Platform } from 'react-native'
import { Colors } from 'react-native-ui-lib'

function Switch({
  className,
  ...props
}: SwitchPrimitives.RootProps & React.RefAttributes<SwitchPrimitives.RootRef>) {
  return (
    <SwitchPrimitives.Root
      className={cn(
        'flex shrink-0 flex-row items-center rounded-full border border-transparent shadow-sm shadow-black/5',
        Platform.select({
          web: 'focus-visible:border-ring focus-visible:ring-ring/50 peer inline-flex outline-none transition-all focus-visible:ring-[3px] disabled:cursor-not-allowed',
        }),
        props.disabled && 'opacity-50',
        className
      )}
      style={{
        width: 48,
        height: 27,
        backgroundColor: props.checked
          ? Colors.$backgroundPrimaryHeavy
          : Colors.$backgroundNeutralIdle,
      }}
      {...props}
    >
      <SwitchPrimitives.Thumb
        className={cn(
          'rounded-full transition-transform',
          Platform.select({
            web: 'pointer-events-none block ring-0',
          })
        )}
        style={[
          {
            width: 20,
            height: 20,
          },
          props.checked
            ? { transform: [{ translateX: 23 }] }
            : {
                transform: [{ translateX: 2 }],
                backgroundColor: Colors.rgba(Colors.$backgroundDefault, 1.0),
              },
        ]}
      />
    </SwitchPrimitives.Root>
  )
}

export { Switch }
