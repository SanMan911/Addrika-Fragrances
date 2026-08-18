import { apiFetch } from './api';

/**
 * The single boot-time endpoint the mobile app hits.
 * Returns brand tokens, feature flags, live impact snapshot,
 * catalog counts, must_upgrade check, deep-link scheme, etc.
 * See backend/routers/app_config.py.
 */
export type AppConfig = {
  schema_version: number;
  min_supported_app_version: number;
  brand: {
    name: string;
    tagline?: string;
    logo_url?: string;
    colors: Record<string, string>;
    fonts?: Record<string, string>;
  };
  contact: Record<string, string>;
  social: Record<string, string>;
  routes: Record<string, string>;
  features: Record<string, boolean>;
  impact: { trees_planted: number };
  catalog: { b2c_count?: number; b2b_count?: number };
  must_upgrade: boolean;
  deep_link_scheme: string;
  public_web_url: string;
};

export async function fetchAppConfig(currentAppVersion = 1): Promise<AppConfig> {
  return apiFetch<AppConfig>(`/api/app/config?v=${currentAppVersion}`);
}
