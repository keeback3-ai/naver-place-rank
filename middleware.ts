import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (authHeader) {
    const encoded = authHeader.split(" ")[1] || "";
    const [user, pwd] = Buffer.from(encoded, "base64").toString().split(":");
    if (user === process.env.BASIC_AUTH_USER && pwd === process.env.BASIC_AUTH_PASSWORD) {
      return NextResponse.next();
    }
  }

  return new NextResponse("인증이 필요합니다.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="SELLA"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health).*)"],
};
