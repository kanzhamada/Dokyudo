import { Context } from "hono";
import { getEnv } from "./env.ts";

export const ACCESS_TOKEN_COOKIE = "dokyudo_access_token";
export const REFRESH_TOKEN_COOKIE = "dokyudo_refresh_token";

const ACCESS_MAX_AGE = 60 * 60 * 24 * 7; // 7 days (604800 seconds)
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

interface CookieAttributes {
  Path: string;
  HttpOnly: boolean;
  SameSite: "Lax" | "Strict" | "None";
  Secure: boolean;
  Domain?: string;
}

function baseCookieAttributes(): CookieAttributes {
  const isProd = getEnv("NODE_ENV") === "prod";
  const attributes: CookieAttributes = {
    Path: "/",
    HttpOnly: true,
    SameSite: "Lax",
    Secure: isProd,
  };

  // In production the API lives on api.dokyudo.my.id and the SPA on
  // dokyudo.my.id — the cookie must be scoped to the shared registrable
  // domain so the browser sends it to both subdomains. In development we
  // leave it host-only so localhost:8000 works out of the box.
  const domain = getEnv("COOKIE_DOMAIN");
  if (domain) {
    attributes.Domain = domain;
  }

  return attributes;
}

function serializeAttributes(attributes: CookieAttributes): string {
  let serialized =
    `Path=${attributes.Path}; HttpOnly; SameSite=${attributes.SameSite}`;
  if (attributes.Secure) serialized += "; Secure";
  if (attributes.Domain) serialized += `; Domain=${attributes.Domain}`;
  return serialized;
}

export function setSessionCookies(
  c: Context,
  accessToken: string,
  refreshToken: string,
): void {
  const attributes = baseCookieAttributes();

  c.header(
    "Set-Cookie",
    `${ACCESS_TOKEN_COOKIE}=${
      encodeURIComponent(accessToken)
    }; Max-Age=${ACCESS_MAX_AGE}; ${serializeAttributes(attributes)}`,
  );
  c.header(
    "Set-Cookie",
    `${REFRESH_TOKEN_COOKIE}=${
      encodeURIComponent(refreshToken)
    }; Max-Age=${REFRESH_MAX_AGE}; ${serializeAttributes(attributes)}`,
    { append: true },
  );
}

export function clearSessionCookies(c: Context): void {
  const attributes = baseCookieAttributes();

  c.header(
    "Set-Cookie",
    `${ACCESS_TOKEN_COOKIE}=; Max-Age=0; ${serializeAttributes(attributes)}`,
  );
  c.header(
    "Set-Cookie",
    `${REFRESH_TOKEN_COOKIE}=; Max-Age=0; ${serializeAttributes(attributes)}`,
    { append: true },
  );
}
