/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DASHBOARD_RESULT_URL: string;
  readonly VITE_DASHBOARD_SENSOR_ALTITUDE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
