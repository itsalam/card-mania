// lib/types.ts

export type AuthStatusType = 'idle' | 'loading' | 'authenticated' | 'signed_out' | 'error';

export interface Profile {
  id: string;
  username: string | null;
  avatar_url: string | null;
  // ...your columns
}