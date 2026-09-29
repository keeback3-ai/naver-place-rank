// 플레이스 순위 조회 + 대표키워드 추출 로직 (서버 전용)
// diccmain 외부 API(N지수/경쟁강도 C 제공)가 막혀서, map.naver.com 브라우저 크롤링(place-crawler.ts)으로
// 순위만 가져오는 방식으로 전환. N지수/경쟁강도는 이 방식으로는 얻을 수 없어 제외한다(대표님 확인, 2026-09-29).

import { crawlPlaceRank, type CrawledPlace } from "./place-crawler";

export interface PlaceItem extends CrawledPlace {
  keywords: string[];
}

export interface AnalyzeResult {
  keyword: string;
  total: number;
  top10: PlaceItem[]; // 상위 10개 (대표키워드 포함)
  myPlace: PlaceItem | null; // 입력한 플레이스 id 매칭 결과
  searchedCount: number; // 실제 조회한 결과 수(광고 제외)
}

async function fetchRepresentativeKeywords(placeId: string): Promise<string[]> {
  try {
    const res = await fetch(`https://pcmap.place.naver.com/restaurant/${placeId}/home`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const html = await res.text();
    const match = html.match(/"keywordList":(\[[^\]]*\])/);
    if (!match) return [];
    return JSON.parse(match[1]) as string[];
  } catch {
    return [];
  }
}

export async function analyzePlace(
  keyword: string,
  placeId: string | null
): Promise<AnalyzeResult> {
  const crawled = await crawlPlaceRank(keyword);

  const top10Raw = crawled.slice(0, 10);
  const myPlaceRaw = placeId ? crawled.find((it) => it.id === placeId) ?? null : null;

  // 대표키워드는 상위 10개 + 내 플레이스(순위권 밖이어도)에 대해서만 조회
  const idsNeedingKeywords = new Set(top10Raw.map((it) => it.id));
  if (myPlaceRaw) idsNeedingKeywords.add(myPlaceRaw.id);

  const keywordEntries = await Promise.all(
    Array.from(idsNeedingKeywords).map(async (id) => [id, await fetchRepresentativeKeywords(id)] as const)
  );
  const keywordMap = new Map(keywordEntries);

  const attachKeywords = (it: CrawledPlace): PlaceItem => ({
    ...it,
    keywords: keywordMap.get(it.id) ?? [],
  });

  return {
    keyword,
    total: crawled.length,
    top10: top10Raw.map(attachKeywords),
    myPlace: myPlaceRaw ? attachKeywords(myPlaceRaw) : null,
    searchedCount: crawled.length,
  };
}
