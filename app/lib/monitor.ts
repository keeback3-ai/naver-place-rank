// 등록 항목을 현재 시점으로 조회해 오늘자 스냅샷을 저장하는 헬퍼 (서버 전용)
import { analyzePlace } from "./place";
import { upsertSnapshot, todayStr, type SnapshotRow } from "./db";
import { getMonthlyVolume } from "./naver-ad";

export async function checkAndStore(
  registrationId: number,
  keyword: string,
  placeId: string
): Promise<SnapshotRow> {
  const [result, monthlyVolume] = await Promise.all([
    analyzePlace(keyword, placeId),
    getMonthlyVolume(keyword),
  ]);
  const mp = result.myPlace;

  // N지수/경쟁강도(C)는 diccmain 외부 API가 막혀서 더 이상 제공하지 않음(2026-09-29,
  // map.naver.com 브라우저 크롤링으로 전환 — 순위만 얻을 수 있어 null로 남김. app/lib/place.ts 참고.
  const snap: SnapshotRow = {
    date: todayStr(),
    checkedAt: new Date().toISOString(),
    rank: mp ? mp.rank : null,
    n1: null,
    n2: null,
    n3: null,
    blogReview: null,
    visitorReview: null,
    total: result.total,
    competition: null,
    name: mp ? mp.name : null,
    keywords: mp ? mp.keywords : [],
    monthlyVolume,
  };

  upsertSnapshot(registrationId, snap);
  return snap;
}

/** "병마피부과, 강남피부과" → ["병마피부과","강남피부과"] (트림/중복 제거) */
export function parseKeywords(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const k = part.trim();
    if (k && !seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  }
  return out;
}
