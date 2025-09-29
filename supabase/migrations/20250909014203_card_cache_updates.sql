ALTER TABLE public.card_images
  ADD CONSTRAINT card_images_card_image_unique UNIQUE (card_id, image_cache_id);