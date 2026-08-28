/** Rota canónica da Biblioteca no Studio. */
export const LIBRARY_PATH = "/studio/library";

export function libraryUrl(params?: {
  category?: string;
  compose?: string;
}) {
  const qs = new URLSearchParams();
  if (params?.category) qs.set("category", params.category);
  if (params?.compose) qs.set("compose", params.compose);
  const q = qs.toString();
  return q ? `${LIBRARY_PATH}?${q}` : LIBRARY_PATH;
}
