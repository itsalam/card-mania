import { Assets } from 'react-native-ui-lib'

// Web override of rn-ui.ts. Metro's `require('./x.png')` isn't available in the
// browser/Vite build, so the PNGs are pulled in as ESM imports — Vite resolves
// each to a URL string, which react-native-web's Image source accepts.
import BookmarkHeart from '@/assets/icons/bookmark_heart.png'
import Fluorescent from '@/assets/icons/fluorescent.png'
import Folder from '@/assets/icons/folder.png'
import PlayingCards from '@/assets/icons/playing_cards.png'
import Verified from '@/assets/icons/verified.png'
import VerifiedOff from '@/assets/icons/verified_off.png'
import WebStore from '@/assets/icons/web_stories.png'

// Load a simple asset group
Assets.loadAssetsGroup('icons', {
  BookmarkHeart,
  Fluorescent,
  Folder,
  PlayingCards,
  Verified,
  VerifiedOff,
  WebStore,
})
