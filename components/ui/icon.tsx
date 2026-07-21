import { cn } from '@/lib/utils/index'
import { createLucideIcon, IconNode, LucideIcon, LucideProps } from 'lucide-react-native'
import { cssInterop } from 'nativewind'

type IconProps = LucideProps & {
  as: LucideIcon
}

function IconImpl({ as: IconComponent, ...props }: IconProps) {
  return <IconComponent {...props} />
}

cssInterop(IconImpl, {
  className: {
    target: 'style',
    nativeStyleToProp: {
      height: 'size',
      width: 'size',
    },
  },
})

/**
 * A wrapper component for Lucide icons with Nativewind `className` support via `cssInterop`.
 *
 * This component allows you to render any Lucide icon while applying utility classes
 * using `nativewind`. It avoids the need to wrap or configure each icon individually.
 *
 * @component
 * @example
 * ```tsx
 * import { ArrowRight } from 'lucide-react-native';
 * import { Icon } from '@/registry/components/ui/icon';
 *
 * <Icon as={ArrowRight} className="text-red-500" size={16} />
 * ```
 *
 * @param {LucideIcon} as - The Lucide icon component to render.
 * @param {string} className - Utility classes to style the icon using Nativewind.
 * @param {number} size - Icon size (defaults to 14).
 * @param {...LucideProps} ...props - Additional Lucide icon props passed to the "as" icon.
 */
function Icon({ as: IconComponent, className, size = 14, ...props }: IconProps) {
  return (
    <IconImpl
      as={IconComponent}
      className={cn('text-foreground', className)}
      size={size}
      {...props}
    />
  )
}

const CardIcon: IconNode = [
  [
    'path',
    {
      fill: 'currentColor',
      d: 'm21.47 4.35l-1.34-.56v9.03l2.43-5.86c.41-1.02-.06-2.19-1.09-2.61',
      key: 'path1',
    },
  ],
  [
    'path',
    {
      fill: 'currentColor',
      fillRule: 'evenodd',
      d: 'm2.03 8.05L6.93 20a2.01 2.01 0 0 0 1.81 1.26c.26 0 .53-.05.79-.16l7.37-3.05c.75-.31 1.21-1.05 1.23-1.79c.01-.26-.04-.55-.13-.81L13 3.5a1.95 1.95 0 0 0-1.81-1.25c-.26 0-.52.06-.77.15L3.06 5.45a1.994 1.994 0 0 0-1.09 2.6m16.15-3.8a2 2 0 0 0-2-2h-1.45l3.45 8.34M11.15 4.27l4.95 11.94l-7.3 3.03L3.85 7.29z',
      key: 'path2',
    },
  ],
]

const Cards = createLucideIcon('Cards', CardIcon)

const WishlistCard = createLucideIcon('Wishlist', [
  [
    'path',
    {
      // fill: 'currentColor',
      // stroke: 'currentColor',
      d: 'm12.34 12.192l1.93-1.163l1.928 1.163l-.523-2.196l1.712-1.475l-2.24-.186l-.878-2.066l-.877 2.066l-2.24.186l1.712 1.475zm4.514 6.27h1.485q-.002.361-.245.617t-.61.317L6.182 20.817q-.671.087-1.2-.32q-.527-.407-.608-1.078l-1.23-9.713q-.08-.672.333-1.216t1.085-.606l.977-.073v1l-.823.068q-.27.019-.424.221t-.115.471l1.196 9.713q.039.27.23.424q.193.153.463.115zm-7.7-2q-.69 0-1.153-.463t-.462-1.153V4.616q0-.691.462-1.153T9.154 3h10.23q.691 0 1.153.463T21 4.616v10.23q0 .69-.463 1.153t-1.153.463zm0-1h10.23q.27 0 .443-.173t.173-.443V4.616q0-.27-.173-.443T19.385 4H9.154q-.27 0-.442.173q-.173.173-.173.443v10.23q0 .27.173.443t.442.173M5.45 19.9',
      key: 'path1',
      strokeWidth: '0.5',
    },
  ],
])

export { Cards, Icon, WishlistCard }
