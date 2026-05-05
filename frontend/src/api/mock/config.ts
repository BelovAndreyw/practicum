export function shouldUseMock(): boolean {
  const flag = import.meta.env.VITE_USE_MOCK;

  // In local dev, default to mock unless explicitly disabled.
  if (import.meta.env.DEV) {
    return flag !== 'false';
  }

  // In production-like modes, mock is disabled unless explicitly enabled.
  return flag === 'true';
}
