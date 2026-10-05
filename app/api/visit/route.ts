import { NextResponse } from "next/server";
import { VISITOR_COOKIE, VISITOR_COOKIE_MAX_AGE, newVisitorId, visitorIdFrom } from "@/lib/visitor";

// "Try the demo" posts here. Only a POST makes a Visitor, so link previews
// and crawlers never do.
export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/demo", request.url), 303);
  if (!visitorIdFrom(request.headers.get("cookie"))) {
    response.cookies.set(VISITOR_COOKIE, newVisitorId(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: VISITOR_COOKIE_MAX_AGE,
    });
  }
  return response;
}
