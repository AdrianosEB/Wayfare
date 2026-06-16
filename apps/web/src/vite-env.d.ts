/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** '1'/'true' forces MSW fixture mocks on; '0'/'false' forces them off. Default: on in dev. */
  readonly VITE_USE_MOCKS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
