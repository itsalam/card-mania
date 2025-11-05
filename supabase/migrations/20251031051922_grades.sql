CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Companies
CREATE TABLE IF NOT EXISTS grading_companies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text UNIQUE NOT NULL,
    name text NOT NULL
);

-- Grade conditions
CREATE TABLE IF NOT EXISTS grade_conditions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES grading_companies(id) ON DELETE CASCADE,
    grade_value numeric(4, 1) NOT NULL,
    label text NOT NULL,
    UNIQUE (company_id, grade_value, label)
);

-- Seed companies
INSERT INTO
    grading_companies (slug, name)
VALUES
    ('psa', 'PSA (Professional Sports Authenticator)'),
    ('bgs', 'Beckett Grading Services (BGS)'),
    ('cgc', 'CGC Cards'),
    ('tag', 'TAG Grading'),
    ('ace', 'ACE Grading') ON CONFLICT (slug) DO NOTHING;

-- PSA (half steps; no 9.5)
INSERT INTO
    grade_conditions (company_id, grade_value, label)
SELECT
    gc.id,
    v.grade_value,
    v.label
FROM
    grading_companies gc
    CROSS JOIN (
        VALUES
            (10.0, 'Gem Mint'),
            (9.0, 'Mint'),
            (8.5, 'Near Mint-Mint'),
            (8.0, 'Near Mint-Mint'),
            (7.5, 'Near Mint'),
            (7.0, 'Near Mint'),
            (6.5, 'Excellent-Mint'),
            (6.0, 'Excellent-Mint'),
            (5.5, 'Excellent'),
            (5.0, 'Excellent'),
            (4.5, 'Very Good-Excellent'),
            (4.0, 'Very Good-Excellent'),
            (3.5, 'Very Good'),
            (3.0, 'Very Good'),
            (2.5, 'Good'),
            (2.0, 'Good'),
            (1.5, 'Fair'),
            (1.0, 'Poor')
    ) AS v(grade_value, label)
WHERE
    gc.slug = 'psa' ON CONFLICT DO NOTHING;

-- BGS (9.5 = Gem Mint, 10 = Pristine)
INSERT INTO
    grade_conditions (company_id, grade_value, label)
SELECT
    gc.id,
    v.grade_value,
    v.label
FROM
    grading_companies gc
    CROSS JOIN (
        VALUES
            (10.0, 'Pristine'),
            (9.5, 'Gem Mint'),
            (9.0, 'Mint'),
            (8.5, 'Near Mint-Mint'),
            (8.0, 'Near Mint-Mint'),
            (7.5, 'Near Mint'),
            (7.0, 'Near Mint'),
            (6.5, 'Excellent-Mint'),
            (6.0, 'Excellent-Mint'),
            (5.5, 'Excellent'),
            (5.0, 'Excellent'),
            (4.5, 'Very Good-Excellent'),
            (4.0, 'Very Good-Excellent'),
            (3.5, 'Very Good'),
            (3.0, 'Very Good'),
            (2.5, 'Good'),
            (2.0, 'Good'),
            (1.5, 'Fair'),
            (1.0, 'Poor')
    ) AS v(grade_value, label)
WHERE
    gc.slug = 'bgs' ON CONFLICT DO NOTHING;

-- CGC (two 10s; includes 9.5 Mint+)
INSERT INTO
    grade_conditions (company_id, grade_value, label)
SELECT
    gc.id,
    v.grade_value,
    v.label
FROM
    grading_companies gc
    CROSS JOIN (
        VALUES
            (10.0, 'Pristine'),
            (10.0, 'Gem Mint'),
            (9.5, 'Mint+'),
            (9.0, 'Mint'),
            (8.5, 'Near Mint-Mint'),
            (8.0, 'Near Mint-Mint'),
            (7.5, 'Near Mint+'),
            (7.0, 'Near Mint'),
            (6.5, 'Excellent-Near Mint'),
            (6.0, 'Excellent-Near Mint'),
            (5.5, 'Excellent+'),
            (5.0, 'Excellent'),
            (4.5, 'Very Good-Excellent'),
            (4.0, 'Very Good-Excellent'),
            (3.5, 'Very Good+'),
            (3.0, 'Very Good'),
            (2.5, 'Good+'),
            (2.0, 'Good'),
            (1.5, 'Fair'),
            (1.0, 'Poor')
    ) AS v(grade_value, label)
WHERE
    gc.slug = 'cgc' ON CONFLICT DO NOTHING;

-- TAG (two 10s; TAG uses internal 100–1000 score but we only store labels/steps)
INSERT INTO
    grade_conditions (company_id, grade_value, label)
SELECT
    gc.id,
    v.grade_value,
    v.label
FROM
    grading_companies gc
    CROSS JOIN (
        VALUES
            (10.0, 'Pristine'),
            (10.0, 'Gem Mint'),
            (9.0, 'Mint'),
            (8.5, 'Near Mint-Mint+'),
            (8.0, 'Near Mint-Mint'),
            (7.5, 'Near Mint+'),
            (7.0, 'Near Mint'),
            (6.5, 'Excellent-Mint+'),
            (6.0, 'Excellent-Mint'),
            (5.5, 'Excellent+'),
            (5.0, 'Excellent'),
            (4.5, 'Very Good-Excellent+'),
            (4.0, 'Very Good-Excellent'),
            (3.5, 'Very Good+'),
            (3.0, 'Very Good'),
            (2.5, 'Good+'),
            (2.0, 'Good'),
            (1.5, 'Fair'),
            (1.0, 'Poor')
    ) AS v(grade_value, label)
WHERE
    gc.slug = 'tag' ON CONFLICT DO NOTHING;

-- ACE (integers only)
INSERT INTO
    grade_conditions (company_id, grade_value, label)
SELECT
    gc.id,
    v.grade_value,
    v.label
FROM
    grading_companies gc
    CROSS JOIN (
        VALUES
            (10.0, 'Gem Mint'),
            (9.0, 'Mint'),
            (8.0, 'Near Mint-Mint'),
            (7.0, 'Near Mint'),
            (6.0, 'Excellent-Mint'),
            (5.0, 'Excellent'),
            (4.0, 'Very Good'),
            (3.0, 'Good'),
            (2.0, 'Fair'),
            (1.0, 'Poor')
    ) AS v(grade_value, label)
WHERE
    gc.slug = 'ace' ON CONFLICT DO NOTHING;