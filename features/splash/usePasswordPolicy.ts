import { getSupabase } from '@/lib/store/client'
import { useQuery } from '@tanstack/react-query'

export type PasswordPolicy = {
  minLength: number
  requireNumber: boolean
  requireUppercase: boolean
  requireLowercase: boolean
  requireSpecial: boolean
}

export type RuleResult = {
  label: string
  met: boolean
}

export type StrengthResult = {
  score: number
  label: string
  rules: RuleResult[]
  allMet: boolean
}

export const DEFAULT_POLICY: PasswordPolicy = {
  minLength: 8,
  requireNumber: true,
  requireUppercase: true,
  requireLowercase: false,
  requireSpecial: false,
}

export function usePasswordPolicy() {
  return useQuery({
    queryKey: ['password-policy'],
    queryFn: async (): Promise<PasswordPolicy> => {
      type Row = {
        min_length: number
        require_number: boolean
        require_uppercase: boolean
        require_lowercase: boolean
        require_special: boolean
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (getSupabase() as any)
        .from('password_policy')
        .select('min_length,require_number,require_uppercase,require_lowercase,require_special')
        .eq('id', 1)
        .maybeSingle()

      if (error || !data) return DEFAULT_POLICY

      const row = data as Row
      return {
        minLength: row.min_length ?? DEFAULT_POLICY.minLength,
        requireNumber: row.require_number ?? DEFAULT_POLICY.requireNumber,
        requireUppercase: row.require_uppercase ?? DEFAULT_POLICY.requireUppercase,
        requireLowercase: row.require_lowercase ?? DEFAULT_POLICY.requireLowercase,
        requireSpecial: row.require_special ?? DEFAULT_POLICY.requireSpecial,
      }
    },
    staleTime: 1000 * 60 * 60,
  })
}

const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'] as const

export function evaluatePassword(password: string, policy: PasswordPolicy): StrengthResult {
  const rules: RuleResult[] = []

  rules.push({
    label: `At least ${policy.minLength} characters`,
    met: password.length >= policy.minLength,
  })
  if (policy.requireUppercase) {
    rules.push({ label: 'One uppercase letter', met: /[A-Z]/.test(password) })
  }
  if (policy.requireNumber) {
    rules.push({ label: 'One number', met: /[0-9]/.test(password) })
  }
  if (policy.requireLowercase) {
    rules.push({ label: 'One lowercase letter', met: /[a-z]/.test(password) })
  }
  if (policy.requireSpecial) {
    rules.push({ label: 'One special character (!@#…)', met: /[^a-zA-Z0-9]/.test(password) })
  }

  const met = rules.filter((r) => r.met).length
  const total = rules.length
  const score = total === 0 ? 0 : Math.round((met / total) * 4)

  return {
    score,
    label: STRENGTH_LABELS[score],
    rules,
    allMet: met === total,
  }
}

export function policyError(password: string, policy: PasswordPolicy): string | null {
  const { rules } = evaluatePassword(password, policy)
  const failed = rules.find((r) => !r.met)
  return failed ? failed.label : null
}
