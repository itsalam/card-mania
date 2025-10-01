import BookmarkHeart from '@/assets/icons/bookmark_heart.svg'
import Fluorescent from '@/assets/icons/fluorescent.svg'
import Folder from '@/assets/icons/folder.svg'
import PlayingCards from '@/assets/icons/playing_cards.svg'
import Verified from '@/assets/icons/verified.svg'
import VerifiedOff from '@/assets/icons/verified_off.svg'
import WebStore from '@/assets/icons/web_stories.svg'
import { DollarSign, LucideProps } from 'lucide-react-native'
import { SvgProps } from 'react-native-svg'

require('@/assets/rn-ui')

export const CardsIcon = (props: SvgProps) => <WebStore {...props} />
export const SetsIcon = (props: SvgProps) => <PlayingCards {...props} />
export const CollectionsIcon = (props: SvgProps) => <Folder {...props} />
export const PriceIcon = (props: LucideProps) => <DollarSign {...props} />
export const SealedIcon = (props: SvgProps) => <Fluorescent {...props} />
export const OwnedIcon = (props: SvgProps) => <Verified {...props} />
export const WishlistedIcon = (props: SvgProps) => <BookmarkHeart {...props} />
export const UnownedIcon = (props: SvgProps) => <VerifiedOff {...props} />
