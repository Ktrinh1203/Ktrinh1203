/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STATIC_HOST?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
