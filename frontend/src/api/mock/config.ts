export function shouldUseMock(): boolean {
  const useMockFlag = import.meta.env.VITE_USE_MOCK;
  const forceRealApi = import.meta.env.VITE_FORCE_REAL_API === 'true';

  // In local dev, always use mock by default so the app works out-of-the-box.
  // To test real backend in dev, set VITE_FORCE_REAL_API=true.
  if (import.meta.env.DEV) {
    return !forceRealApi;
  }

  // In production-like modes, mock is disabled unless explicitly enabled.
  return useMockFlag === 'true';
}
