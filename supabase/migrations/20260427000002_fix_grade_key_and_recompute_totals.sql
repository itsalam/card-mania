-- Fix the grade key construction: numeric(4,1)::text produces "10.0"/"9.5" but
-- grades_prices stores keys as "psa10"/"psa9_5". Replace the helper and the
-- card-price trigger, then recompute totals from scratch.
create
or replace function public ._collection_item_value_cents(
    p_item_kind public .item_kind,
    p_ref_id uuid,
    p_grade_condition_id uuid,
    p_quantity int default 1
) returns int language sql stable as $$ with pk as (
    select
        coalesce(
            (
                select
                    gc.slug || replace(
                        trim(
                            trailing '.'
                            from
                                trim(
                                    trailing '0'
                                    from
                                        gcnd.grade_value :: text
                                )
                        ),
                        '.',
                        '_'
                    )
                from
                    public .grade_conditions gcnd
                    left join public .grading_companies gc on gc.id = gcnd.company_id
                where
                    gcnd.id = p_grade_condition_id
            ),
            'ungraded'
        ) as key
)
select
    coalesce(
        (
            select
                coalesce((c .grades_prices ->> pk.key) :: int, 0)
            from
                pk
                join public .cards c on c .id = p_ref_id
            where
                p_item_kind = 'card' :: public .item_kind
            limit
                1
        ), 0
    ) * coalesce(p_quantity, 1);

$$;

create
or replace function public ._collection_totals_bump_on_card_prices() returns trigger language plpgsql security definer
set
    search_path = public as $$ begin
        if TG_OP = 'UPDATE'
        and (
            new .grades_prices is distinct
            from
                old .grades_prices
        ) then with deltas as (
            select
                ci.collection_id,
                sum(
                    coalesce(
                        (
                            new .grades_prices ->> coalesce(
                                gc.slug || replace(
                                    trim(
                                        trailing '.'
                                        from
                                            trim(
                                                trailing '0'
                                                from
                                                    gcnd.grade_value :: text
                                            )
                                    ),
                                    '.',
                                    '_'
                                ),
                                'ungraded'
                            )
                        ) :: int,
                        0
                    ) - coalesce(
                        (
                            old .grades_prices ->> coalesce(
                                gc.slug || replace(
                                    trim(
                                        trailing '.'
                                        from
                                            trim(
                                                trailing '0'
                                                from
                                                    gcnd.grade_value :: text
                                            )
                                    ),
                                    '.',
                                    '_'
                                ),
                                'ungraded'
                            )
                        ) :: int,
                        0
                    )
                ) * coalesce(ci.quantity, 1) as delta_cents
            from
                public .collection_items ci
                left join public .grade_conditions gcnd on gcnd.id = ci.grade_condition_id
                left join public .grading_companies gc on gc.id = gcnd.company_id
            where
                ci.item_kind = 'card' :: public .item_kind
                and ci.ref_id = new .id
            group by
                ci.collection_id
            having
                sum(
                    coalesce(
                        (
                            new .grades_prices ->> coalesce(
                                gc.slug || replace(
                                    trim(
                                        trailing '.'
                                        from
                                            trim(
                                                trailing '0'
                                                from
                                                    gcnd.grade_value :: text
                                            )
                                    ),
                                    '.',
                                    '_'
                                ),
                                'ungraded'
                            )
                        ) :: int,
                        0
                    ) - coalesce(
                        (
                            old .grades_prices ->> coalesce(
                                gc.slug || replace(
                                    trim(
                                        trailing '.'
                                        from
                                            trim(
                                                trailing '0'
                                                from
                                                    gcnd.grade_value :: text
                                            )
                                    ),
                                    '.',
                                    '_'
                                ),
                                'ungraded'
                            )
                        ) :: int,
                        0
                    )
                ) <> 0
        )
        insert into
            public .collection_totals (
                collection_id,
                total_cents,
                quantity_total,
                computed_at
            )
        select
            d.collection_id,
            d.delta_cents,
            0,
            now()
        from
            deltas d on conflict (collection_id) do
        update
        set
            total_cents = public .collection_totals.total_cents + excluded.total_cents,
            computed_at = excluded.computed_at;

end if;

return new;

end;

$$;

-- Recompute totals now that _collection_item_value_cents returns correct values.
-- NULL-quantity rows are treated as 1 (matching the trigger's coalesce logic).
-- Explicit quantity = 0 rows (soft-deleted items) are excluded.
insert into
    public .collection_totals (
        collection_id,
        total_cents,
        quantity_total,
        computed_at
    )
select
    ci.collection_id,
    coalesce(
        sum(
            public ._collection_item_value_cents(
                ci.item_kind,
                ci.ref_id,
                ci.grade_condition_id,
                ci.quantity
            )
        ),
        0
    ) as total_cents,
    coalesce(sum(coalesce(ci.quantity, 1)), 0) as quantity_total,
    now()
from
    public .collection_items ci
where
    ci.quantity is null
    or ci.quantity > 0
group by
    ci.collection_id on conflict (collection_id) do
update
set
    total_cents = excluded.total_cents,
    quantity_total = excluded.quantity_total,
    computed_at = excluded.computed_at;

-- Reseed history with the corrected totals.
insert into
    public .collection_value_history (
        collection_id,
        total_cents,
        quantity_total,
        snapshotted_at
    )
select
    ct.collection_id,
    ct.total_cents,
    coalesce(ct.quantity_total, 0),
    now()
from
    public .collection_totals ct;