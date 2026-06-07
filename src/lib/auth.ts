export const ACCESS_COOKIE = "grh_access";

export function isAccessControlEnabled() {
  return Boolean(process.env.APP_PASSWORD?.trim());
}

export async function hasValidAccessCookie(value: string | undefined) {
  if (!isAccessControlEnabled()) {
    return true;
  }

  if (!value) {
    return false;
  }

  return constantTimeEqual(value, await accessSignature());
}

export async function accessSignature() {
  const secret =
    process.env.APP_ENCRYPTION_KEY?.trim() ||
    process.env.APP_PASSWORD?.trim() ||
    "grad-research-hub-dev-secret";
  const payload = `${secret}:grad-research-hub-access`;
  const bytes = new TextEncoder().encode(payload);
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return base64Url(new Uint8Array(digest));
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return diff === 0;
}
