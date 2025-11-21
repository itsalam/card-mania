import { TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import * as TabsPrimitive from '@rn-primitives/tabs';
import * as React from 'react';
import { Text, TextProps, View } from 'react-native';
import { Colors } from 'react-native-ui-lib';

const Tabs = TabsPrimitive.Root;

function TabsList({
  className,
  ...props
}: TabsPrimitive.ListProps & {
  ref?: React.RefObject<TabsPrimitive.ListRef>;
}) {
  return (
    <TabsPrimitive.List
      className={cn(
        'web:inline-flex h-12 native:h-12 items-center justify-center rounded-md p-1 native:px-3 pb-0',
        className
      )}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  ...props
}: TabsPrimitive.TriggerProps & {
  ref?: React.RefObject<TabsPrimitive.TriggerRef>;
}) {
  const { value } = TabsPrimitive.useRootContext();
  return (
    <TextClassContext.Provider
      value={cn(
        'text-sm native:text-base font-medium text-muted-foreground web:transition-all',
        value === props.value && 'text-foreground'
      )}
    >
      <TabsPrimitive.Trigger
        className={cn(
          'inline-flex items-center justify-center shadow-none web:whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium web:ring-offset-background web:transition-all web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-ring web:focus-visible:ring-offset-2',
          props.disabled && 'web:pointer-events-none opacity-50',
          props.value === value && 'bg-background-0/90 shadow-lg shadow-foreground/10',
          className
        )}
        {...props}
      />
    </TextClassContext.Provider>
  );
}

function TabsLabel({
  className,
  label,
  value,
  style,
  children,
  ...props
}: TextProps & {label: string, value: string}
) {
  const { value: currentValue } = TabsPrimitive.useRootContext();
  return <View className="flex flex-row items-center justify-center gap-2">{children}<Text className="text-xl" style={[style, currentValue === value ? { color: Colors.$textDefault } : { color: Colors.$textDefault }, { display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }]} {...props}>{label.charAt(0).toUpperCase() + label.slice(1)}</Text></View>
}

function TabsContent({
  className,
  ...props
}: TabsPrimitive.ContentProps & {
  ref?: React.RefObject<TabsPrimitive.ContentRef>;
}) {
  return (
    <TabsPrimitive.Content
      className={cn(
        'web:ring-offset-background web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-ring web:focus-visible:ring-offset-2 p-2',
        className
      )}
      {...props}
    />
  );
}

export { Tabs, TabsContent, TabsLabel, TabsList, TabsTrigger };

