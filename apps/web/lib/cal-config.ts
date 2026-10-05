/** Username público Cal.com (embed + links). */
export function getCalUsername() {
  return (
    process.env.NEXT_PUBLIC_CALCOM_USERNAME?.trim() ||
    "isaque-portilho-nutfa9"
  );
}

/** Slug do event type activo no Cal (ex.: neuma1-1). */
export function getCalEventTypeSlug() {
  return (
    process.env.NEXT_PUBLIC_CALCOM_EVENT_TYPE?.trim() ||
    "neuma1-1"
  );
}

export function getCalLink(username?: string | null, eventType?: string | null) {
  const user = (username || getCalUsername()).trim();
  const slug = (eventType || getCalEventTypeSlug()).trim();
  return `${user}/${slug}`;
}

/**
 * API key Cal.com (server-only). Aceita CAL_API_KEY ou o alias legado `CAL`.
 */
export function getCalApiKey() {
  return (
    process.env.CAL_API_KEY?.trim() ||
    process.env.CAL?.trim() ||
    ""
  );
}
