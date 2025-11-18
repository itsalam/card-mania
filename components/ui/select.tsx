import { Icon } from '@/components/ui/icon'
import { NativeOnlyAnimatedView } from '@/components/ui/native-only-animated-view'
import { TextClassContext } from '@/components/ui/text'
import { cn } from '@/lib/utils/index'
import * as SelectPrimitive from '@rn-primitives/select'
import { Check, ChevronDown, ChevronDownIcon, ChevronUpIcon } from 'lucide-react-native'
import * as React from 'react'
import { Platform, ScrollView, StyleSheet, View } from 'react-native'
import { FadeIn, FadeOut } from 'react-native-reanimated'
import { FullWindowOverlay as RNFullWindowOverlay } from 'react-native-screens'
import { Colors } from 'react-native-ui-lib'
import { useCombinedRefs } from '../hooks/useCombinedRefs'
import { MeasuredLayout, useMeasure } from '../hooks/useMeasure'
import { DynamicBorderBox } from './border-label-decorator/border'
import FloatingPlaceholder from './border-label-decorator/placeholder'
import { useAnimatedColors } from './input/provider'
import { styles } from './input/styles'

type Option = SelectPrimitive.Option

type SelectRootRef = React.ComponentRef<typeof SelectPrimitive.Root>
type SelectRootProps = React.ComponentPropsWithoutRef<typeof SelectPrimitive.Root>

const SelectLayoutContext = React.createContext<{
  layout?: MeasuredLayout
  setLayout: React.Dispatch<React.SetStateAction<MeasuredLayout | undefined>>
} | null>(null)

const Select = React.forwardRef<SelectRootRef, SelectRootProps>(({ children, ...props }, ref) => {
  const [layout, setLayout] = React.useState<MeasuredLayout>()
  return (
    <SelectPrimitive.Root {...props} ref={ref}>
      <SelectLayoutContext.Provider value={{ layout: layout, setLayout }}>
        {children}
      </SelectLayoutContext.Provider>
    </SelectPrimitive.Root>
  )
})

const SelectGroup = SelectPrimitive.Group

function SelectValue({
  ref,
  className,
  placeholder,
  ...props
}: Omit<SelectPrimitive.ValueProps, 'placeholder'> &
  React.RefAttributes<SelectPrimitive.ValueRef> & {
    className?: string
    placeholder?: string
  }) {
  const { value, open } = SelectPrimitive.useRootContext()
  const {
    ref: inputLayoutRef,
    layout: inputLayout,
    onLayout: onInputLayout,
  } = useMeasure<SelectPrimitive.ValueRef>()
  const { ref: fieldLayoutRef, layout: fieldLayout, onLayout: onFieldLayout } = useMeasure<View>()
  const combinedRef = useCombinedRefs(ref, inputLayoutRef)

  return (
    <View style={[styles.field]} onLayout={onFieldLayout} ref={fieldLayoutRef}>
      <SelectPrimitive.Value
        ref={combinedRef}
        onLayout={onInputLayout}
        className={cn('line-clamp-1 flex flex-row items-center gap-2', className)}
        style={[
          styles.inputTextStyle,
          {
            flexDirection: 'row',
            alignItems: 'center',
            flex: 1,
            marginTop: 18,
          },
        ]}
        {...props}
      />
      <FloatingPlaceholder
        placeholder={placeholder}
        placeHolderStyle={[styles.inputTextStyle]}
        fieldOffset={fieldLayout ?? undefined}
        inputOffset={inputLayout ?? undefined}
        // inputOffset={inputLayout ?? undefined}
      />
      <Icon as={ChevronDown} aria-hidden={true} size={16} />
    </View>
  )
}

const useSelectLayout = () => {
  const context = React.useContext(SelectLayoutContext)
  if (!context) {
    throw new Error('useSelectLayout must be used within a SelectLayoutContext.Provider')
  }
  return context
}

function SelectTrigger({
  ref,
  className,
  children,
  size = 'default',
  label,
  onLayout: onLayoutOuter,
  ...props
}: SelectPrimitive.TriggerProps &
  React.RefAttributes<SelectPrimitive.TriggerRef> & {
    children?: React.ReactNode
    size?: 'default' | 'sm'
    label?: string
  }) {
  const { open, value } = SelectPrimitive.useRootContext()
  const { setLayout } = useSelectLayout()
  const { ref: layoutRef, layout, onLayout } = useMeasure<SelectPrimitive.TriggerRef>()

  const getColor = React.useMemo(() => {
    return value ? Colors.$textPrimary : open ? Colors.$textPrimary : Colors.$textNeutralLight
  }, [value, open])

  const getOpacity = React.useMemo(() => (open || Boolean(value) ? 1 : 0), [open, value])

  const { color, opacity } = useAnimatedColors(getColor, getOpacity)

  React.useEffect(() => {
    if (layout) {
      setLayout(layout)
    }
  }, [layout, setLayout])

  return (
    <SelectPrimitive.Trigger
      {...props}
      ref={ref}
      className={cn(
        'flex flex-row items-center justify-between gap-2 shadow-sm shadow-black/5',
        Platform.select({
          web: 'focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:hover:bg-input/50 w-fit whitespace-nowrap text-sm outline-none transition-[color,box-shadow] focus-visible:ring-[3px] disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:shrink-0',
        }),
        props.disabled && 'opacity-50',
        className
      )}
    >
      <DynamicBorderBox
        forceFloat={open || Boolean(value)}
        label={label}
        color={color}
        opacity={opacity}
        style={[styles.container, { alignItems: 'center' }]}
        ref={layoutRef}
        onLayout={(e) => {
          onLayoutOuter?.(e)
          onLayout(e)
        }}
      >
        {children}
      </DynamicBorderBox>
    </SelectPrimitive.Trigger>
  )
}

const FullWindowOverlay = Platform.OS === 'ios' ? RNFullWindowOverlay : React.Fragment

function SelectContent({
  className,
  children,
  position = 'popper',
  portalHost,
  ...props
}: SelectPrimitive.ContentProps &
  React.RefAttributes<SelectPrimitive.ContentRef> & {
    className?: string
    portalHost?: string
  }) {
  const { layout } = useSelectLayout()
  return (
    <SelectPrimitive.Portal hostName={portalHost}>
      <FullWindowOverlay>
        <SelectPrimitive.Overlay style={Platform.select({ native: StyleSheet.absoluteFill })}>
          <TextClassContext.Provider value="text-popover-foreground">
            <NativeOnlyAnimatedView className="z-50" entering={FadeIn} exiting={FadeOut}>
              <SelectPrimitive.Content
                style={{ width: layout?.width, backgroundColor: Colors.$backgroundDefault }}
                className={cn(
                  'border-border relative z-50 rounded-md border shadow-md shadow-black/5',
                  Platform.select({
                    web: cn(
                      'animate-in fade-in-0 zoom-in-95 origin-(--radix-select-content-transform-origin) max-h-52 overflow-y-auto overflow-x-hidden',
                      props.side === 'bottom' && 'slide-in-from-top-2',
                      props.side === 'top' && 'slide-in-from-bottom-2'
                    ),
                    native: 'p-1',
                  }),
                  position === 'popper' &&
                    Platform.select({
                      web: cn(
                        props.side === 'bottom' && 'translate-y-1',
                        props.side === 'top' && '-translate-y-1'
                      ),
                    }),
                  className
                )}
                position={position}
                {...props}
              >
                <SelectScrollUpButton />
                <SelectPrimitive.Viewport
                  className={cn(
                    'p-1',
                    position === 'popper' &&
                      cn(
                        'w-full',
                        Platform.select({
                          web: 'h-[var(--radix-select-trigger-height)] min-w-[var(--radix-select-trigger-width)]',
                        })
                      )
                  )}
                >
                  {children}
                </SelectPrimitive.Viewport>
                <SelectScrollDownButton />
              </SelectPrimitive.Content>
            </NativeOnlyAnimatedView>
          </TextClassContext.Provider>
        </SelectPrimitive.Overlay>
      </FullWindowOverlay>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({
  className,
  ...props
}: SelectPrimitive.LabelProps & React.RefAttributes<SelectPrimitive.LabelRef>) {
  return <SelectPrimitive.Label className={cn(className)} {...props} />
}

function SelectItem({
  className,
  children,
  ...props
}: SelectPrimitive.ItemProps & React.RefAttributes<SelectPrimitive.ItemRef>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        'active:bg-accent group relative flex w-full flex-row items-center gap-2',
        Platform.select({
          web: 'focus:bg-accent focus:text-accent-foreground *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2 cursor-default outline-none data-[disabled]:pointer-events-none [&_svg]:pointer-events-none',
        }),
        props.disabled && 'opacity-50',
        className
      )}
      style={[styles.container]}
      {...props}
    >
      <View className="absolute right-2 flex size-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Icon as={Check} size={20} className="text-muted-foreground shrink-0" />
        </SelectPrimitive.ItemIndicator>
      </View>
      <SelectPrimitive.ItemText
        style={[styles.inputTextStyle]}
        className="text-foreground group-active:text-accent-foreground select-none text-sm"
      />
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({
  className,
  ...props
}: SelectPrimitive.SeparatorProps & React.RefAttributes<SelectPrimitive.SeparatorRef>) {
  return (
    <SelectPrimitive.Separator
      className={cn(
        'bg-border -mx-1 my-1 h-px',
        Platform.select({ web: 'pointer-events-none' }),
        className
      )}
      {...props}
    />
  )
}

/**
 * @platform Web only
 * Returns null on native platforms
 */
function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  if (Platform.OS !== 'web') {
    return null
  }
  return (
    <SelectPrimitive.ScrollUpButton
      className={cn('flex cursor-default items-center justify-center py-1', className)}
      {...props}
    >
      <Icon as={ChevronUpIcon} className="size-4" />
    </SelectPrimitive.ScrollUpButton>
  )
}

/**
 * @platform Web only
 * Returns null on native platforms
 */
function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  if (Platform.OS !== 'web') {
    return null
  }
  return (
    <SelectPrimitive.ScrollDownButton
      className={cn('flex cursor-default items-center justify-center py-1', className)}
      {...props}
    >
      <Icon as={ChevronDownIcon} className="size-4" />
    </SelectPrimitive.ScrollDownButton>
  )
}

/**
 * @platform Native only
 * Returns the children on the web
 */
function NativeSelectScrollView({ className, ...props }: React.ComponentProps<typeof ScrollView>) {
  if (Platform.OS === 'web') {
    return <>{props.children}</>
  }
  return <ScrollView className={cn('max-h-52', className)} {...props} />
}

export {
  NativeSelectScrollView,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  type Option,
}
