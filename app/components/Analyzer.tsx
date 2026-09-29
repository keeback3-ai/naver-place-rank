"use client";

import { useState } from "react";
import type { AnalyzeResult } from "../lib/place";

export default function Analyzer() {
  const [keyword, setKeyword] = useState("");
  const [placeId, setPlaceId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalyzeResult | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!keyword.trim()) {
      setError("키워드를 입력하세요.");
      return;
    }
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const params = new URLSearchParams({ q: keyword.trim() });
      if (placeId.trim()) params.set("id", placeId.trim());
      const res = await fetch(`/api/place?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "조회 실패");
      setData(json as AnalyzeResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "조회 실패");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <p className="mb-6 text-sm text-gray-500">
        키워드와 플레이스 ID로 순위와 대표키워드를 분석합니다.
      </p>

      <form
        onSubmit={handleSearch}
        className="mb-8 grid grid-cols-1 gap-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:grid-cols-[1fr_1fr_auto]"
      >
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            키워드 *
          </label>
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="예: 강남맛집"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-900"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            플레이스 ID (선택)
          </label>
          <input
            value={placeId}
            onChange={(e) => setPlaceId(e.target.value)}
            placeholder="예: 1046192699"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-900"
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={loading}
            className="h-[38px] w-full rounded-lg bg-gray-900 px-6 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:opacity-50 sm:w-auto"
          >
            {loading ? "분석 중…" : "분석"}
          </button>
        </div>
      </form>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {data && <Results data={data} placeId={placeId.trim()} />}
    </div>
  );
}

function Results({ data, placeId }: { data: AnalyzeResult; placeId: string }) {
  return (
    <div className="space-y-6">
      {/* 요약 카드 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card title="내 플레이스 순위">
          {placeId ? (
            data.myPlace ? (
              <div>
                <p className="text-3xl font-bold text-gray-900">
                  {data.myPlace.rank}
                  <span className="ml-1 text-base font-medium text-gray-400">위</span>
                </p>
                <p className="mt-1 truncate text-sm text-gray-600">
                  {data.myPlace.name}
                </p>
              </div>
            ) : (
              <p className="text-sm font-medium text-gray-500">
                순위권 밖 (상위 {data.searchedCount}개 중 없음)
              </p>
            )
          ) : (
            <p className="text-sm text-gray-400">플레이스 ID 미입력</p>
          )}
        </Card>

        <Card title="검색 결과 총 업체 수">
          <p className="text-3xl font-bold text-gray-900">
            {data.total.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-gray-400">광고 제외, 오가닉 결과 기준</p>
        </Card>
      </div>

      {/* 상위 10개 대표키워드 */}
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-base font-semibold text-gray-900">
            상위 10개 플레이스 · 대표키워드
          </h2>
          <span className="text-xs text-gray-400">키워드: {data.keyword}</span>
        </div>
        <div className="space-y-3">
          {data.top10.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-2 rounded-xl border border-gray-100 p-3 sm:flex-row sm:items-center"
            >
              <div className="flex items-center gap-3 sm:w-56 sm:shrink-0">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white">
                  {item.rank}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900">
                    {item.name}
                  </p>
                  <p className="truncate text-xs text-gray-400">{item.category}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {item.keywords.map((kw) => (
                  <span
                    key={kw}
                    className="rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-700"
                  >
                    #{kw}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
        {title}
      </p>
      {children}
    </div>
  );
}
