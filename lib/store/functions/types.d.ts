import { Database } from "@/lib/store/supabase";

// ---- Types (adjust to your generated types) ----
export type ViewTarget = "card" | "listing";

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type ProfileUpdate = Partial<
  Pick<ProfileRow, "username" | "display_name" | "avatar_url" | "bio">
>;

export type CollectionRow = Database["public"]["Views"]["collections"]["Row"];
export type CollectionWithTagRow =
  Database["public"]["Views"]["collections_with_tags"]["Row"];
export type CollectionInsert =
  Database["public"]["Tables"]["collections"]["Insert"];
export type CollectionUpdate = Partial<
  Pick<
    CollectionRow,
    "name" | "description" | "is_public" | "cover_image_url" | "slug"
  >
>;

export type GradeCondition =
  Database["public"]["Tables"]["grade_conditions"]["Row"];

export type CollectionItemRow =
  & Database["public"]["Tables"]["collection_items"]["Row"]
  & { grade_condition: GradeCondition | null };

export type RecentViewRow = Database["public"]["Tables"]["recent_views"]["Row"];
