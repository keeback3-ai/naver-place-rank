// 네이버 검색광고 API로 키워드 월 검색량(PC+모바일) 조회 (서버 전용)
import crypto from "crypto";

const CUSTOMER_ID = process.env.NAVER_AD_CUSTOMER_ID;
const ACCESS_LICENSE = process.env.NAVER_AD_ACCESS_LICENSE;
const SECRET_KEY = process.env.NAVER_AD_SECRET_KEY;

const BASE_URL = "https://api.naver.com";
const URI = "/keywordstool";

function buildSignature(timestamp: string, method: string, uri: string): string {
  const message = `${timestamp}.${method}.${uri}`;
  return crypto.createHmac("sha256", SECRET_KEY!).update(message).digest("base64");
}

function normalizeCount(value: string | number): number {
  if (typeof value === "number") return value;
  if (value === "< 10") return 10;
  const n = parseInt(value, 10);
  return isNaN(n) ? 0 : n;
}

/** 키워드의 월간 검색량(PC+모바일 합산)을 조회. 키 미설정/오류 시 null 반환 */
export async function getMonthlyVolume(keyword: string): Promise<number | null> {
  if (!CUSTOMER_ID || !ACCESS_LICENSE || !SECRET_KEY) return null;

  try {
    const timestamp = Date.now().toString();
    const signature = buildSignature(timestamp, "GET", URI);
    const normalized = keyword.replace(/\s+/g, "");
    const url = `${BASE_URL}${URI}?hintKeywords=${encodeURIComponent(normalized)}&showDetail=1`;

    const res = await fetch(url, {
      headers: {
        "X-Timestamp": timestamp,
        "X-API-KEY": ACCESS_LICENSE,
        "X-Customer": CUSTOMER_ID,
        "X-Signature": signature,
      },
      cache: "no-store",
    });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      keywordList?: { relKeyword: string; monthlyPcQcCnt: string | number; monthlyMobileQcCnt: string | number }[];
    };
    const exact = data.keywordList?.find((k) => k.relKeyword === normalized) ?? data.keywordList?.[0];
    if (!exact) return null;

    return normalizeCount(exact.monthlyPcQcCnt) + normalizeCount(exact.monthlyMobileQcCnt);
  } catch {
    return null;
  }
}
