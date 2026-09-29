import { NextResponse } from "next/server";
import "../../lib/ensure-scheduler";

export const runtime = "nodejs";

// Railway 헬스체크 전용 (Basic Auth 미들웨어 제외 대상).
// 호출되는 순간 ensure-scheduler가 로드되어 스케줄러가 함께 기동된다.
export async function GET() {
  return NextResponse.json({ ok: true });
}
