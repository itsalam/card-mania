import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
export const cn = (...i: any[]) => twMerge(clsx(...i))