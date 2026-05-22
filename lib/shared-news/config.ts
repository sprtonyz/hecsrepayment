type SharedNewsConfig = {
  url?: string;
  secretKey?: string;
  reviewToken?: string;
};

export function getSharedNewsConfig(): SharedNewsConfig {
  return {
    url: process.env.SUPABASE_URL?.trim(),
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
