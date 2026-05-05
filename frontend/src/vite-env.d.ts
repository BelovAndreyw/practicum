/// <reference types="vite/client" />

declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}

interface ImportMetaEnv {
  readonly VITE_BACKEND_URL: string;
  readonly VITE_API_BASE: string;
  readonly VITE_USE_MOCK: string;
  readonly VITE_FORCE_REAL_API: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
