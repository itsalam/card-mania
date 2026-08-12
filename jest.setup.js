jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)

// reportError()'s imperativeDevToast() is a no-op when no toast is registered
// (`_devToast?.(args)`), but importing the real components/Toast.tsx drags in
// react-native-ui-lib -> uilib-native, which ships native ESM Jest can't parse.
jest.mock('@/components/Toast', () => ({
  imperativeDevToast: jest.fn(),
}))

// lib/store/client.ts's real module imports expo-constants and creates a
// dangling `_clientReady` timer at import time — touching either trips
// jest-expo's winter-runtime "require outside test scope" guard here. Hook
// tests never want a live Supabase client anyway, so replace the whole
// module with an in-memory fake. `getSupabase()` always returns the same
// object, so test files can grab it via `getSupabase()` to configure/assert
// on its jest.fn()s.
jest.mock('@/lib/store/client', () => {
  const mockClient = {
    rpc: jest.fn(),
    from: jest.fn(),
    auth: { getUser: jest.fn() },
    functions: { invoke: jest.fn() },
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(),
    })),
  }
  return {
    getSupabase: jest.fn(() => mockClient),
    initSupabase: jest.fn(() => mockClient),
    signalClientReady: jest.fn(),
    supabaseRestFetch: jest.fn(),
  }
})
