import BookmarkHeart from '@/assets/icons/bookmark_heart.svg'
import Fluorescent from '@/assets/icons/fluorescent.svg'
import Folder from '@/assets/icons/folder.svg'
import PlayingCards from '@/assets/icons/playing_cards.svg'
import Verified from '@/assets/icons/verified.svg'
import VerifiedOff from '@/assets/icons/verified_off.svg'
import WebStore from '@/assets/icons/web_stories.svg'
import { DollarSign } from 'lucide-react-native'

export const CardsIcon = (props: any) => <WebStore {...props} />
export const SetsIcon = (props: any) => <PlayingCards {...props} />
export const CollectionsIcon = (props: any) => <Folder {...props} />
export const PriceIcon = (props: any) => <DollarSign {...props} />
export const SealedIcon = (props: any) => <Fluorescent {...props} />
export const OwnedIcon = (props: any) => <Verified {...props} />
export const WishlistedIcon = (props: any) => <BookmarkHeart {...props} />
export const UnownedIcon = (props: any) => <VerifiedOff {...props} />
