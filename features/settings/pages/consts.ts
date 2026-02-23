import { SettingsLayoutSection } from '@/features/settings/types'
import {
  Bell,
  MapPin,
  MessageCircle,
  Monitor,
  Moon,
  PersonStanding,
  ShieldBan,
  Sun,
  SunMoon,
  UserPen,
} from 'lucide-react-native'

export const SETTINGS_SECTIONS: Record<string, SettingsLayoutSection> = {
  general: {
    label: 'General & Local info',
    items: {
      location: {
        label: 'Location',
        type: 'custom',
        Icon: MapPin,
        key: 'location',
      },
      themeMode: {
        key: 'themeMode',
        label: 'Theme',
        type: 'toggle',
        Icon: SunMoon,
        values: [
          {
            Icon: Sun,
            value: 'light',
          },
          {
            Icon: Moon,
            value: 'dark',
          },
          {
            Icon: Monitor,
            value: 'system',
          },
        ],
      },
      account: {
        key: 'account-settings',
        label: 'Account Settings',
        type: 'page',
        Icon: PersonStanding,
        page: {
          label: 'Account Settings',
          items: {},
        },
      },
      profile: {
        key: 'profile-settings',
        label: 'Public Profile Settings',
        type: 'page',
        Icon: UserPen,
        page: {
          label: 'Account Settings',
          items: {},
        },
      },
    },
  },
  social: {
    label: 'Socials and Interactions',
    items: {
      messages: {
        key: 'message-settings',
        label: 'Messages',
        type: 'page',
        Icon: MessageCircle,
        page: {
          label: 'Account Settings',
          items: {},
        },
      },
      notifications: {
        key: 'notification-settings',
        label: 'Notifications',
        type: 'page',
        Icon: Bell,
        page: {
          label: 'Account Settings',
          items: {},
        },
      },
      blocked: {
        key: 'blocked-list',
        label: 'Blocked',
        type: 'page',
        Icon: ShieldBan,
        page: {
          label: 'Account Settings',
          items: {},
        },
      },
    },
  },
}
