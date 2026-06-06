"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ACCESS_COOKIE, accessSignature, verifyAccessPassword } from "@/lib/auth";

export async function login(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const nextPath = String(formData.get("next") ?? "/");

  if (!(await verifyAccessPassword(password))) {
    redirect(`/login?error=1&next=${encodeURIComponent(nextPath)}`);
  }

  const cookieStore = await cookies();
  cookieStore.set(ACCESS_COOKIE, await accessSignature(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
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
