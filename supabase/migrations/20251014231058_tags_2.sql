DROP FUNCTION IF EXISTS public.suggest_tags(
    q text,
    max_results int,
    tau_hours int,
    personal_w numeric,
    global_w numeric,
    sim_thresh numeric,
    curated_w numeric
);