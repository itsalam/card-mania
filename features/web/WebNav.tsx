import { Avatar, AvatarFallback, AvatarFallbackText, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ExpandableSearchBar, SearchBar } from '@/components/ui/search'
import { Text } from '@/components/ui/text/base-text'
import { useCartPanelStore } from '@/lib/store/useCartPanelStore'
import { useCartStore } from '@/lib/store/useCartStore'
import { useUserStore } from '@/lib/store/useUserStore'
import { Link, usePathname, useRouter } from 'expo-router'
import {
  ArrowLeftRight,
  ChevronDown,
  Home,
  LogOut,
  Menu,
  Settings as SettingsIcon,
  ShoppingCart,
  Tag,
  User,
} from 'lucide-react-native'
import { MotiView } from 'moti'
import { useEffect, useRef, useState } from 'react'
import { Image, Pressable, TextInput, useWindowDimensions, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { NAV_HEIGHT, NAV_LOGO_SIZE, NAV_MARGIN_H, NAV_PADDING_H, NAV_TOP } from './layout-constants'
import { NavSearchDropdown } from './NavSearchDropdown'

type WebNavProps = {
  currentUser?: {
    display_name?: string | null
    avatar_url?: string | null
    username?: string | null
  } | null
  searchQuery?: string
  onSearchChange?: (q: string) => void
  scrolled?: boolean
  onSignInPress?: () => void
}

export function WebNav({
  currentUser,
  searchQuery,
  onSearchChange,
  scrolled,
  onSignInPress,
}: WebNavProps) {
  const { signOut, user } = useUserStore()
  const email = user?.email
  const router = useRouter()
  const pathname = usePathname()

  const handleSignOut = async () => {
    await signOut()
    router.replace('/')
  }
  const cartCount = useCartStore((s) => s.items.reduce((n, i) => n + i.cart.quantity, 0))
  const openCartPanel = useCartPanelStore((s) => s.setOpen)
  const { width } = useWindowDimensions()
  const isPortrait = width < 768
  const [searchExpanded, setSearchExpanded] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)
  const searchInputRef = useRef<TextInput>(null)
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleFocus = () => {
    if (blurTimer.current) clearTimeout(blurTimer.current)
    setSearchFocused(true)
  }
  const handleBlur = () => {
    blurTimer.current = setTimeout(() => setSearchFocused(false), 150)
  }

  useEffect(() => {
    if (searchExpanded) {
      const id = setTimeout(() => searchInputRef.current?.focus?.(), 80)
      return () => clearTimeout(id)
    }
  }, [searchExpanded])

  const initials =
    currentUser?.display_name?.[0]?.toUpperCase() ??
    currentUser?.username?.[0]?.toUpperCase() ??
    '?'

  const displayName = currentUser?.display_name ?? currentUser?.username ?? ''
  const marginH = isPortrait ? 12 : NAV_MARGIN_H

  const PORTRAIT_TABS = [
    { href: '/', label: 'Home', Icon: Home, authRequired: false },
    { href: '/offers', label: 'Offers', Icon: Tag, authRequired: true },
    { href: '/transactions', label: 'Transactions', Icon: ArrowLeftRight, authRequired: true },
    { href: '/settings', label: 'Settings', Icon: SettingsIcon, authRequired: true },
  ]

  const menu = (
    <View
      style={
        {
          flexDirection: 'row',
          gap: 4,
          paddingVertical: 0,
          paddingHorizontal: 6,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: Colors.rgba(Colors.$outlineNeutral, 0.4),
          backgroundColor: Colors.rgba(Colors.$backgroundDefault, 0.75),
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        } as any
      }
    >
      {PORTRAIT_TABS.filter((t) => !t.authRequired || currentUser).map(({ href, label, Icon }) => {
        const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
        return (
          <Link key={href} href={href as any} asChild>
            <Pressable
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                paddingHorizontal: 14,
                paddingVertical: 3,
                marginVertical: 3,
                borderRadius: 999,
                backgroundColor: isActive
                  ? Colors.rgba(Colors.$backgroundPrimaryHeavy, 0.15)
                  : 'transparent',
              }}
            >
              <Icon
                size={13}
                color={isActive ? Colors.$backgroundPrimaryHeavy : Colors.$textNeutral}
              />
              <Text
                style={{
                  fontSize: 12,
                  // fontWeight: isActive ? '600' : '400',
                  color: isActive ? Colors.$textDefault : Colors.$textNeutral,
                }}
              >
                {label}
              </Text>
            </Pressable>
          </Link>
        )
      })}

      {/* Cart pill */}
      <Pressable
        onPress={() => openCartPanel(true)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          paddingVertical: 7,
          paddingHorizontal: 14,
          borderRadius: 999,
        }}
      >
        <View style={{ position: 'relative' }}>
          <ShoppingCart size={13} color={Colors.$textNeutral} />
          {cartCount > 0 && (
            <View
              style={{
                position: 'absolute',
                top: -4,
                right: -5,
                backgroundColor: Colors.$backgroundPrimaryHeavy,
                borderRadius: 999,
                minWidth: 13,
                height: 13,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 2,
              }}
            >
              <Text style={{ fontSize: 8, fontWeight: '700', color: '#fff', lineHeight: 12 }}>
                {cartCount > 99 ? '99+' : cartCount}
              </Text>
            </View>
          )}
        </View>
        <Text style={{ fontSize: 12, color: Colors.$textNeutral }}>Cart</Text>
      </Pressable>
    </View>
  )

  return (
    <>
      <View
        style={[
          {
            position: 'fixed',
            top: NAV_TOP,
            zIndex: 50,
            flexDirection: 'row',
            alignItems: 'center',
            marginHorizontal: marginH,
            borderWidth: 1,
            borderColor: Colors.rgba(Colors.$outlineNeutral, 0.5),
            gap: 6,
            marginTop: NAV_TOP,
            paddingHorizontal: NAV_PADDING_H,
            height: NAV_HEIGHT,
            borderRadius: 40,
            alignSelf: 'stretch',
            width: `calc(100vw - ${marginH * 2}px)`,
            justifyContent: 'space-between',
            transition:
              'background-color 0.25s ease, border-color 0.25s ease, backdrop-filter 0.25s ease',
          } as any,
          scrolled
            ? {
                backgroundColor: Colors.rgba(Colors.$backgroundDefault, 0.4),
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(12px)',
              }
            : undefined,
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, position: 'relative' }}>
          {/* Logo + nav links — collapse together when portrait search expands */}
          <MotiView
            animate={{
              opacity: isPortrait && searchExpanded ? 0 : 1,
              width: isPortrait && searchExpanded ? 0 : undefined,
            }}
            transition={{ type: 'timing', duration: 180 }}
            pointerEvents={isPortrait && searchExpanded ? 'none' : 'auto'}
            style={{
              overflow: 'hidden',
              flexShrink: 0,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Link href="/">
              <Image
                source={require('../../assets/images/CM_LOGO.png')}
                style={{ width: NAV_LOGO_SIZE, height: NAV_LOGO_SIZE, borderRadius: 4 }}
              />
            </Link>
          </MotiView>

          {/* Portrait: ExpandableSearchBar — always rendered; flex:1 on its outer View
            right-aligns the collapsed circle and expands the pill leftward */}
          {isPortrait && onSearchChange !== undefined && (
            <ExpandableSearchBar
              ref={searchInputRef}
              expanded={searchExpanded}
              onLeftIconPress={() => setSearchExpanded(true)}
              onDismiss={() => {
                setSearchExpanded(false)
                onSearchChange?.('')
              }}
              value={searchQuery}
              onChangeText={onSearchChange}
              placeholder="Search sellers..."
              placeholderTextColor={Colors.$textNeutralLight}
              onFocus={handleFocus}
              onBlur={handleBlur}
            />
          )}

          {/* Landscape: static search input */}
          {!isPortrait && onSearchChange !== undefined && (
            <SearchBar
              value={searchQuery}
              onChangeText={onSearchChange}
              placeholder="Search sellers..."
              placeholderTextColor={Colors.$textNeutralLight}
              onFocus={handleFocus}
              onBlur={handleBlur}
              style={{
                flex: 1,
                marginLeft: 6,
                maxWidth: 480,
              }}
            />
          )}

          {/* User search results / suggested sellers dropdown */}
          {searchFocused && (
            <NavSearchDropdown
              query={searchQuery ?? ''}
              onSelect={() => setSearchFocused(false)}
              style={
                isPortrait
                  ? ({ position: 'absolute', top: 38 + 8, left: 0, right: 0 } as any)
                  : ({
                      position: 'absolute',
                      top: 38 + 8,
                      left: 64,
                      maxWidth: 480,
                      width: '100%',
                    } as any)
              }
            />
          )}
        </View>

        {/* Nav links + cart — landscape only */}
        {!isPortrait && menu}

        {/* Auth: portrait → dropdown, landscape → inline */}
        {isPortrait ? (
          <DropdownMenu>
            <DropdownMenuTrigger>
              {currentUser ? (
                <View
                  style={
                    {
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                      paddingHorizontal: 6,
                      paddingVertical: 4,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: Colors.rgba(Colors.$outlineNeutral, 0.55),
                      backgroundColor: Colors.rgba(Colors.$backgroundElevated, 0.85),
                      boxShadow: '0 1px 4px rgba(0,0,0,0.18), 0 0 0 1px rgba(255,255,255,0.04)',
                    } as any
                  }
                >
                  <Avatar size="xs" alt={displayName}>
                    {currentUser.avatar_url ? (
                      <AvatarImage source={{ uri: currentUser.avatar_url }} />
                    ) : null}
                    <AvatarFallback>
                      <AvatarFallbackText>{initials}</AvatarFallbackText>
                    </AvatarFallback>
                  </Avatar>
                  <ChevronDown size={11} color={Colors.$textNeutral} />
                </View>
              ) : (
                <Pressable style={{ padding: 4 }}>
                  <Menu size={22} color={Colors.$textDefault} />
                </Pressable>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {currentUser ? (
                <>
                  {/* Profile header */}
                  <View
                    style={{
                      alignItems: 'center',
                      paddingHorizontal: 16,
                      paddingTop: 14,
                      paddingBottom: 10,
                      gap: 8,
                    }}
                  >
                    <Avatar size="md" alt={displayName}>
                      {currentUser.avatar_url ? (
                        <AvatarImage source={{ uri: currentUser.avatar_url }} />
                      ) : null}
                      <AvatarFallback>
                        <AvatarFallbackText>{initials}</AvatarFallbackText>
                      </AvatarFallback>
                    </Avatar>
                    <View style={{ alignItems: 'center', gap: 2 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.$textDefault }}>
                        {displayName}
                      </Text>
                      {(currentUser.username || email) && (
                        <Text style={{ fontSize: 12, color: Colors.$textNeutral }}>
                          {currentUser.username ? `@${currentUser.username}` : email}
                        </Text>
                      )}
                    </View>
                  </View>
                  <DropdownMenuSeparator />
                  {currentUser.username && (
                    <DropdownMenuItem
                      onPress={() => router.push(`/${currentUser.username}` as any)}
                    >
                      <User size={14} color={Colors.$textNeutral} />
                      <Text style={{ fontSize: 14 }}>View profile</Text>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onPress={() => router.push('/settings' as any)}>
                    <SettingsIcon size={14} color={Colors.$textNeutral} />
                    <Text style={{ fontSize: 14 }}>Settings</Text>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onPress={handleSignOut}>
                    <LogOut size={14} color={Colors.$textNeutral} />
                    <Text style={{ fontSize: 14 }}>Sign out</Text>
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem onPress={onSignInPress}>
                  <Text>Sign in</Text>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : currentUser ? (
          <DropdownMenu>
            <DropdownMenuTrigger>
              <View
                style={
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    paddingHorizontal: 6,
                    paddingVertical: 4,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: Colors.rgba(Colors.$outlineNeutral, 0.55),
                    backgroundColor: Colors.rgba(Colors.$backgroundElevated, 0.85),
                    boxShadow: '0 1px 4px rgba(0,0,0,0.18), 0 0 0 1px rgba(255,255,255,0.04)',
                  } as any
                }
              >
                <Avatar size="xs" alt={displayName}>
                  {currentUser.avatar_url ? (
                    <AvatarImage source={{ uri: currentUser.avatar_url }} />
                  ) : null}
                  <AvatarFallback>
                    <AvatarFallbackText>{initials}</AvatarFallbackText>
                  </AvatarFallback>
                </Avatar>
                <ChevronDown size={11} color={Colors.$textNeutral} />
              </View>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {/* Profile header */}
              <View
                style={{
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  paddingTop: 14,
                  paddingBottom: 10,
                  gap: 8,
                }}
              >
                <Avatar size="md" alt={displayName}>
                  {currentUser.avatar_url ? (
                    <AvatarImage source={{ uri: currentUser.avatar_url }} />
                  ) : null}
                  <AvatarFallback>
                    <AvatarFallbackText>{initials}</AvatarFallbackText>
                  </AvatarFallback>
                </Avatar>
                <View style={{ alignItems: 'center', gap: 2 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.$textDefault }}>
                    {displayName}
                  </Text>
                  {(currentUser.username || email) && (
                    <Text style={{ fontSize: 12, color: Colors.$textNeutral }}>
                      {currentUser.username ? `@${currentUser.username}` : email}
                    </Text>
                  )}
                </View>
              </View>
              <DropdownMenuSeparator />
              {currentUser.username && (
                <DropdownMenuItem onPress={() => router.push(`/${currentUser.username}` as any)}>
                  <User size={14} color={Colors.$textNeutral} />
                  <Text style={{ fontSize: 14 }}>View profile</Text>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onPress={() => router.push('/settings' as any)}>
                <SettingsIcon size={14} color={Colors.$textNeutral} />
                <Text style={{ fontSize: 14 }}>Settings</Text>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onPress={handleSignOut}>
                <LogOut size={14} color={Colors.$textNeutral} />
                <Text style={{ fontSize: 14 }}>Sign out</Text>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Pressable onPress={onSignInPress}>
            <Text variant="muted">Sign in</Text>
          </Pressable>
        )}
      </View>

      {/* Portrait tab bar — in normal flow, sits below the fixed nav pill */}
      {isPortrait && (
        <View
          style={{
            marginTop: NAV_TOP + NAV_HEIGHT + 16,
            alignItems: 'center',
          }}
        >
          {menu}
        </View>
      )}
    </>
  )
}
