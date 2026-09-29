"use server";

import { cookies } from "next/headers";

import { SIGNUP_FINISHING_COOKIE } from "@/lib/auth/signup-wizard";

const options = {
  path: "/",
  maxAge: 1800,
  sameSite: "lax" as const,
  httpOnly: true,
};

export async function setSignupFinishingCookieAction() {
  const jar = await cookies();
  jar.set(SIGNUP_FINISHING_COOKIE, "1", options);
}

export async function clearSignupFinishingCookieAction() {
  const jar = await cookies();
  jar.set(SIGNUP_FINISHING_COOKIE, "", { ...options, maxAge: 0 });
}
