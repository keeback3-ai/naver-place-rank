// 네이버 지도 브라우저 크롤링으로 플레이스 순위를 가져온다.
// diccmain 외부 API(N지수/경쟁강도 C 제공)가 막혀서, 강의 1단계 원안대로
// map.naver.com을 직접 크롤링해 순위만 가져오는 방식으로 대체한다. N지수/C는 이 방식으로는 얻을 수 없다.
// 결과 항목의 data-nlog-params 속성(JSON)에 place_id/rank/is_ad가 직접 들어있어
// 강의가 언급한 class명(dPXjn) 기반 광고 필터 대신 이 값을 사용한다(라이브 DOM 확인, 2026-09-29).

import { chromium, type Browser } from "playwright";

const LIST_CONTAINER = "#_pcmap_list_scroll_container";

export interface CrawledPlace {
  rank: number;
  id: string;
  name: string;
  category: string;
}

let browserPromise: Promise<Browser> | null = null;

function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({ headless: true });
  }
  return browserPromise;
}

export async function crawlPlaceRank(keyword: string): Promise<CrawledPlace[]> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  try {
    const url = `https://map.naver.com/p/search/${encodeURIComponent(keyword)}`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

    // 검색 결과는 iframe(searchIframe, place/list) 안에 있음
    let frame = null;
    for (let i = 0; i < 20; i++) {
      frame = page
        .frames()
        .find((f) => f.url().includes("place/list") || f.name() === "searchIframe");
      if (frame) break;
      await page.waitForTimeout(500);
    }
    if (!frame) {
      throw new Error("검색 결과 iframe을 찾지 못했습니다.");
    }

    await frame.waitForSelector(LIST_CONTAINER, { timeout: 15000 });

    // 결과를 최대한 로드하기 위해 스크롤을 3회 반복
    for (let i = 0; i < 3; i++) {
      await frame.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (el) el.scrollTop = el.scrollHeight;
      }, LIST_CONTAINER);
      await page.waitForTimeout(800);
    }

    const items = await frame.evaluate((containerSel) => {
      const container = document.querySelector(containerSel);
      if (!container) return [];
      const lis = Array.from(container.querySelectorAll(":scope > ul > li"));
      const results: { id: string; name: string; category: string; isAd: boolean }[] = [];

      for (const li of lis) {
        // 광고 표시(is_ad)는 li 안의 부가 링크(리뷰/이벤트 등)에 붙는 경우가 있어
        // li 안의 모든 data-nlog-params를 다 파싱해서 하나라도 is_ad면 광고로 판단한다.
        const links = Array.from(
          li.querySelectorAll<HTMLAnchorElement>("a[data-nlog-params]")
        );
        let placeId: string | null = null;
        let isAd = false;
        for (const link of links) {
          const raw = link.getAttribute("data-nlog-params");
          if (!raw) continue;
          let parsed: { place_id?: string; is_ad?: boolean; rank?: number } = {};
          try {
            parsed = JSON.parse(raw);
          } catch {
            continue;
          }
          if (parsed.is_ad === true) isAd = true;
          if (parsed.place_id && parsed.rank !== undefined) placeId = parsed.place_id;
          else if (parsed.place_id && !placeId) placeId = parsed.place_id;
        }
        if (!placeId) continue;

        const nameEl = li.querySelector("span.TYaxT");
        const name = nameEl?.textContent?.trim() ?? "";
        const categoryEl = li.querySelector("span.KCMnt");
        const category = categoryEl?.textContent?.trim() ?? "";

        results.push({ id: placeId, name, category, isAd });
      }
      return results;
    }, LIST_CONTAINER);

    // 광고 제외 후 순위 재부여, 같은 place_id 중복 제거
    const seen = new Set<string>();
    const organic: typeof items = [];
    for (const it of items) {
      if (it.isAd || seen.has(it.id)) continue;
      seen.add(it.id);
      organic.push(it);
    }

    return organic.map((it, idx) => ({
      rank: idx + 1,
      id: it.id,
      name: it.name,
      category: it.category,
    }));
  } finally {
    await context.close();
  }
}

export async function closeCrawler(): Promise<void> {
  if (browserPromise) {
    const browser = await browserPromise;
    await browser.close();
    browserPromise = null;
  }
}
