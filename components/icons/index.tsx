import { assetsMap as LucideAssets } from "@/assets/icons/rn-ui.generated";
import { Award, BadgeCheck, Brush, Signature, Star, Tag, Volleyball } from "lucide-react-native";
import { Assets } from "react-native-ui-lib";

export const TagCategoryToIcon = {
    "auto-mem": Signature,
    "design": Brush,
    "parallels": Star,
    grading: BadgeCheck,
    general: Tag,
    sport: Volleyball,
    rarity: Award,
}

Assets.loadAssetsGroup("icons", {
    BookmarkHeart: require("@/assets/icons/bookmark_heart.png"),
    Fluorescent: require("@/assets/icons/fluorescent.png"),
    Folder: require("@/assets/icons/folder.png"),
    PlayingCards: require("@/assets/icons/playing_cards.png"),
    Verified: require("@/assets/icons/verified.png"),
    VerifiedOff: require("@/assets/icons/verified_off.png"),
    WebStore: require("@/assets/icons/web_stories.png"),
});

Assets.loadAssetsGroup("lucide", LucideAssets);

