// hooks/useGradingConditions.ts
import { supabase } from "@/lib/store/client";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

// ---------- Types & validation ----------
const GradeConditionZ = z.object({
    grade_value: z.number(), // numeric(4,1) arrives as number from supabase-js
    label: z.string(),
    id: z.string(),
});

const CompanyRowZ = z.object({
    id: z.uuid(),
    slug: z.string(),
    name: z.string(),
    grade_conditions: z.array(GradeConditionZ).default([]),
});

const PayloadZ = z.array(CompanyRowZ);

export type GradeCondition = z.infer<typeof GradeConditionZ>;
export type CompanyRow = z.infer<typeof CompanyRowZ>;

export type CompanyWithGrades = {
    id: string;
    slug: string; // 'psa' | 'bgs' | 'cgc' | 'tag' | 'ace'
    name: string;
    grades: GradeCondition[]; // sorted DESC by grade_value (keeps duplicate 10.0 labels for CGC/TAG)
};

// ---------- Query Key ----------

export const gradingConditionsKeys = {
    all: ["grading-conditions"] as const,
    byCompany: (slug: string) => ["grading-conditions", slug] as const,
};

// ---------- Fetcher ----------

async function fetchCompaniesWithGrades(
    companySlug?: string,
): Promise<CompanyWithGrades[]> {
    // Embedded select returns companies with joined grade_conditions, ordered desc by grade
    // NOTE: order(...) with foreignTable is how we sort the embedded relation.
    let q = supabase
        .from("grading_companies")
        .select(
            `
      id, slug, name,
      grade_conditions:grade_conditions (
        id, grade_value, label
      )
    `,
        )
        .order("slug", { ascending: true })
        .order("grade_value", {
            ascending: false,
            foreignTable: "grade_conditions",
        });

    if (companySlug) q = q.eq("slug", companySlug);

    const { data, error } = await q;
    if (error) throw error;

    const payload = PayloadZ.parse(data ?? []);
    return payload.map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        grades: [...c.grade_conditions].sort((a, b) =>
            b.grade_value - a.grade_value
        ),
    }));
}

// ---------- Hook (one hook; optional filter by company) ----------

export function useGradingConditions(opts?: { companySlug?: string }) {
    const slug = opts?.companySlug?.trim();
    return useQuery({
        queryKey: slug
            ? gradingConditionsKeys.byCompany(slug)
            : gradingConditionsKeys.all,
        queryFn: () => fetchCompaniesWithGrades(slug),
        staleTime: 60 * 60 * 1000 * 24, // 24h
        gcTime: 60 * 60 * 1000 * 48, // 48h
    });
}

// ---------- Niceties: helpers for consumers ----------

export type GradingLookups = {
    bySlug: Record<string, CompanyWithGrades>;
    // e.g., "cgc:10.0" -> ['Pristine','Gem Mint']
    labelsByCompanyAndValue: Record<string, string[]>;
};

/** Build quick lookup maps from the hook’s data */
export function buildGradingLookups(rows: CompanyWithGrades[]): GradingLookups {
    const bySlug: Record<string, CompanyWithGrades> = {};
    const labelsByCompanyAndValue: Record<string, string[]> = {};
    for (const c of rows) {
        bySlug[c.slug] = c;
        for (const g of c.grades) {
            const k = `${c.slug}:${g.grade_value.toFixed(1)}`;
            (labelsByCompanyAndValue[k] ??= []).push(g.label);
        }
    }
    return { bySlug, labelsByCompanyAndValue };
}
