import { redirect } from "next/navigation";

import { oneToOneInvitePath } from "@/lib/one-to-one/invite-path";

/** Legacy links: `/1-1/{token}` → `/{token}`. */
export default async function OneToOneLegacyRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  const raw = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") qs.set(key, value);
    else if (Array.isArray(value)) {
      for (const item of value) qs.append(key, item);
    }
  }
  const query = qs.toString();
  redirect(
    `${oneToOneInvitePath(token)}${query ? `?${query}` : ""}`,
  );
}
