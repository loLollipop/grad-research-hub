"use server";

import { cookies } from "next/headers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ACCESS_COOKIE, accessSignature } from "@/lib/auth";
import { verifyAccessPasswordInput } from "@/lib/settings";

export async function login(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const nextPath = String(formData.get("next") ?? "/");

  if (!(await verifyAccessPasswordInput(password))) {
    redirect(`/login?error=1&next=${encodeURIComponent(nextPath)}`);
  }

  const cookieStore = await cookies();
  cookieStore.set(ACCESS_COOKIE, await accessSignature(), {
    httpOnly: true,
    sameSite: "lax",
    secure: await shouldUseSecureCookie(),
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  redirect(safeNextPath(nextPath));
}

function safeNextPath(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}

async function shouldUseSecureCookie() {
  const override = process.env.APP_COOKIE_SECURE?.trim().toLowerCase();

  if (override === "true") {
    return true;
  }

  if (override === "false") {
    return false;
  }

  const forwardedProto = (await headers()).get("x-forwarded-proto");
  const proto = forwardedProto?.split(",")[0]?.trim().toLowerCase();

  return proto === "https";
}
