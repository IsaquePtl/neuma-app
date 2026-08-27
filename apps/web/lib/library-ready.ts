/** Biblioteca = só material mentor-ready. Cascas do Agent ficam fora até promoção. */
export type LibraryContentStatus = "empty" | "drafting" | "ready";

export function isReadyLibraryAsset(asset: {
  content_status?: LibraryContentStatus | string | null;
}): boolean {
  return (asset.content_status ?? "ready") === "ready";
}

export function isAgentEmptyShell(asset: {
  content_status?: LibraryContentStatus | string | null;
  created_by_agent?: boolean | null;
}): boolean {
  return (
    Boolean(asset.created_by_agent) &&
    (asset.content_status === "empty" || asset.content_status === "drafting")
  );
}
