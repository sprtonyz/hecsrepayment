type SharedNewsConfig = {
  url?: string;
  secretKey?: string;
  reviewToken?: string;
};

export function normalizeSupabaseUrl(value?: string) {
  if (!value) {
    return undefined;
  }

  try {
    const url = new URL(value);
    url.pathname = "/";
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return value.trim().replace(/\/rest\/v1\/?$/i, "").replace(/\/$/, "");
  }
}

export function getSharedNewsConfig(): SharedNewsConfig {
  return {
    url: normalizeSupabaseUrl(process.env.SUPABASE_URL),
    secretKey:
      process.env.SUPABASE_SECRET_KEY?.trim() ||
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
    reviewToken: process.env.SHARED_REVIEW_TOKEN?.trim(),
  };
}

export function isSharedNewsSyncEnabled() {
  const config = getSharedNewsConfig();
  return Boolean(config.url && config.secretKey);
}
