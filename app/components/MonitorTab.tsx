"use client";

import { useEffect, useState } from "react";
import type { RegistrationRow, SnapshotRow } from "../lib/monitor-types";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// 순위 구간 필터 정의 (탭마다 색상 구분)
interface RangeDef {
  key: string;
  label: string;
  min: number;
  max: number;
  dot: string;
}
const RANGES: RangeDef[] = [
  { key: "all", label: "전체", min: 1, max: Infinity, dot: "bg-gray-400" },
  { key: "1-3", label: "1~3위", min: 1, max: 3, dot: "bg-blue-500" },
  { key: "1-5", label: "1~5위", min: 1, max: 5, dot: "bg-red-500" },
  { key: "1-10", label: "1~10위", min: 1, max: 10, dot: "bg-emerald-500" },
  { key: "1-20", label: "1~20위", min: 1, max: 20, dot: "bg-violet-500" },
  { key: "6-20", label: "6~20위", min: 6, max: 20, dot: "bg-amber-500" },
  { key: "21-50", label: "21~50위", min: 21, max: 50, dot: "bg-pink-500" },
  { key: "51-100", label: "51~100위", min: 51, max: 100, dot: "bg-cyan-500" },
];

function latestSnapshot(reg: RegistrationRow): SnapshotRow | null {
  return reg.snapshots[0] ?? null;
}

function inRange(rank: number | null, r: RangeDef): boolean {
  if (r.key === "all") return true;
  if (rank === null) return false;
  return rank >= r.min && rank <= r.max;
}

// 최근 n일 날짜 배열 (오늘 → 과거)
function lastDates(n: number): { key: string; label: string }[] {
  const base = new Date();
  const out: { key: string; label: string }[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() - i);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    out.push({
      key: `${d.getFullYear()}-${mm}-${dd}`,
      label: `${mm}-${dd}(${WEEKDAYS[d.getDay()]})`,
    });
  }
  return out;
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(
    d.getHours()
  )}:${p(d.getMinutes())}`;
}

export default function MonitorTab() {
  const [registrations, setRegistrations] = useState<RegistrationRow[]>([]);
  const [keywords, setKeywords] = useState("");
  const [placeId, setPlaceId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState("all");
  const [busy, setBusy] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  // 초기 로드
  useEffect(() => {
    fetch("/api/monitor")
      .then((r) => r.json())
      .then((d) => setRegistrations(d.registrations ?? []))
      .catch(() => setError("목록을 불러오지 못했습니다."));
  }, []);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!placeId.trim()) return setError("플레이스 ID를 입력하세요.");
    if (!keywords.trim()) return setError("키워드를 입력하세요. (콤마로 여러 개)");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId: placeId.trim(), keywords }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "등록 실패");
      setRegistrations(json.registrations);
      if (json.errors?.length) setError(`일부 조회 실패: ${json.errors.join(" / ")}`);
      setKeywords("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "등록 실패");
    } finally {
      setLoading(false);
    }
  }

  async function recheck(id?: number) {
    if (id) setBusy((s) => new Set(s).add(id));
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/monitor/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(id ? { id } : {}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "재검색 실패");
      setRegistrations(json.registrations);
      if (json.errors?.length) setError(`일부 조회 실패: ${json.errors.join(" / ")}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "재검색 실패");
    } finally {
      if (id)
        setBusy((s) => {
          const n = new Set(s);
          n.delete(id);
          return n;
        });
      else setLoading(false);
    }
  }

  async function remove(id: number) {
    if (!confirm("이 항목을 삭제할까요? (기록도 함께 삭제됩니다)")) return;
    setBusy((s) => new Set(s).add(id));
    try {
      const res = await fetch(`/api/monitor?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "삭제 실패");
      setRegistrations(json.registrations);
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제 실패");
    } finally {
      setBusy((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    }
  }

  const counts = (r: RangeDef) =>
    registrations.filter((reg) => inRange(latestSnapshot(reg)?.rank ?? null, r)).length;

  const filtered = registrations.filter((reg) =>
    inRange(latestSnapshot(reg)?.rank ?? null, RANGES.find((r) => r.key === range)!)
  );

  return (
    <div>
      <p className="mb-6 text-sm text-gray-500">
        키워드(콤마로 여러 개)와 플레이스 ID를 등록하면 키워드별로 순위를 매일 누적
        기록합니다. 히스토리는 체크할 때마다 쌓입니다.
      </p>

      {/* 등록 폼 */}
      <form
        onSubmit={handleRegister}
        className="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:grid-cols-[1fr_240px_auto]"
      >
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            키워드 (콤마로 여러 개) *
          </label>
          <input
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="예: 강남피부과, 역삼피부과, 선릉피부과"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-900"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            플레이스 ID *
          </label>
          <input
            value={placeId}
            onChange={(e) => setPlaceId(e.target.value)}
            placeholder="예: 12907191"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-900"
          />
        </div>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            disabled={loading}
            className="h-[38px] rounded-lg bg-blue-600 px-6 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "처리 중…" : "등록"}
          </button>
          <button
            type="button"
            onClick={() => recheck()}
            disabled={loading || registrations.length === 0}
            className="h-[38px] rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-40"
          >
            전체 재검색
          </button>
        </div>
      </form>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* 1. 순위 구간 필터 탭 */}
      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        {RANGES.map((r) => {
          const active = range === r.key;
          return (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`flex flex-col items-start gap-1 rounded-xl border-2 bg-white px-3 py-2.5 text-left transition ${
                active
                  ? "border-blue-500 shadow-sm"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                <span className={`h-2 w-2 rounded-full ${r.dot}`} />
                {r.label}
              </span>
              <span className="text-lg font-bold text-gray-900">
                {counts(r)}
                <span className="ml-0.5 text-xs font-medium text-gray-400">개</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* 2. 메인 데이터 테이블 */}
      {registrations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center text-sm text-gray-400">
          등록된 키워드가 없습니다. 위에서 키워드와 플레이스 ID를 등록하세요.
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center text-sm text-gray-400">
          선택한 순위 구간에 해당하는 항목이 없습니다.
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((reg, idx) => (
            <RegistrationRowCard
              key={reg.id}
              no={idx + 1}
              reg={reg}
              days={expanded.has(reg.id) ? 30 : 9}
              onToggleDays={() =>
                setExpanded((s) => {
                  const n = new Set(s);
                  if (n.has(reg.id)) n.delete(reg.id);
                  else n.add(reg.id);
                  return n;
                })
              }
              busy={busy.has(reg.id)}
              onRecheck={() => recheck(reg.id)}
              onDelete={() => remove(reg.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RegistrationRowCard({
  no,
  reg,
  days,
  onToggleDays,
  busy,
  onRecheck,
  onDelete,
}: {
  no: number;
  reg: RegistrationRow;
  days: number;
  onToggleDays: () => void;
  busy: boolean;
  onRecheck: () => void;
  onDelete: () => void;
}) {
  const latest = latestSnapshot(reg);
  const byDate = new Map(reg.snapshots.map((s) => [s.date, s]));
  const dates = lastDates(days);
  const placeUrl = `https://m.place.naver.com/place/${reg.placeId}/home`;

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      {/* 메타 정보 바 */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-gray-100 bg-gray-50/60 px-4 py-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white">
            {no}
          </span>
          <span className="rounded-md bg-gray-200 px-2 py-0.5 text-xs text-gray-600">
            {reg.group}
          </span>
        </div>

        {/* 검색 키워드 + 아이콘 2개 */}
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-gray-900">{reg.keyword}</span>
          <a
            href={`https://search.naver.com/search.naver?query=${encodeURIComponent(
              reg.keyword
            )}`}
            target="_blank"
            rel="noreferrer"
            title="네이버에서 키워드 검색"
            className="text-gray-400 hover:text-gray-700"
          >
            🔍
          </a>
          <button
            title="키워드 복사"
            onClick={() => navigator.clipboard?.writeText(reg.keyword)}
            className="text-gray-400 hover:text-gray-700"
          >
            📋
          </button>
        </div>

        {/* 플레이스 URL */}
        <a
          href={placeUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-blue-600 underline-offset-2 hover:underline"
        >
          {reg.placeId}
        </a>

        {/* 업체명 */}
        <span className="text-sm text-gray-700">
          {latest?.name ? `${latest.name}(${reg.placeId})` : "업체명 미확인"}
        </span>

        {/* 월 검색량 + 경쟁 업체수 */}
        <span className="text-xs text-gray-500">
          월 {latest?.monthlyVolume ?? "-"}건 업체 {latest?.total ?? "-"}개
        </span>

        {/* 대표키워드 */}
        <div className="hidden flex-wrap gap-1 md:flex">
          {(latest?.keywords ?? []).slice(0, 3).map((kw) => (
            <span
              key={kw}
              className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600"
            >
              #{kw}
            </span>
          ))}
        </div>

        {/* 등록일 + 체크시간 */}
        <span className="text-xs text-gray-400">
          등록 {fmtDateTime(reg.registeredAt)} · 체크 {fmtDateTime(latest?.checkedAt ?? null)}
        </span>

        {/* 관리 */}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={onRecheck}
            disabled={busy}
            className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-100 disabled:opacity-50"
          >
            {busy ? "검색 중…" : "재검색요청"}
          </button>
          <button
            onClick={onDelete}
            disabled={busy}
            className="rounded-lg px-2 py-1.5 text-xs text-gray-400 transition hover:text-red-500 disabled:opacity-50"
          >
            삭제
          </button>
        </div>
      </div>

      {/* 순위 히스토리 (가로 스크롤) */}
      <div className="overflow-x-auto px-4 py-4">
        <div className="flex gap-2">
          {dates.map((d) => (
            <HistoryCell key={d.key} label={d.label} snap={byDate.get(d.key) ?? null} />
          ))}
        </div>
      </div>

      {/* 더보기 */}
      <div className="border-t border-gray-100 py-2 text-center">
        <button
          onClick={onToggleDays}
          className="text-xs font-medium text-gray-500 hover:text-gray-800"
        >
          {days > 9 ? "접기 ▲" : "더보기 ▼"}
        </button>
      </div>
    </div>
  );
}

function HistoryCell({
  label,
  snap,
}: {
  label: string;
  snap: SnapshotRow | null;
}) {
  return (
    <div className="w-[112px] shrink-0 rounded-lg border border-gray-100 bg-gray-50/40">
      <div className="rounded-t-lg border-b border-gray-100 bg-white px-2 py-1 text-center text-[11px] font-medium text-gray-500">
        {label}
      </div>
      {snap ? (
        <div className="space-y-0.5 px-2 py-2 text-center text-[11px] leading-tight">
          <p className="text-sm font-bold text-gray-900">
            {snap.rank !== null ? `${snap.rank}위` : "순위밖"}
          </p>
          <p className="text-gray-500">
            블 {snap.blogReview ?? "-"} · 방 {snap.visitorReview ?? "-"}
          </p>
          <p className="text-gray-500">
            월 {snap.monthlyVolume ?? "-"}건 · 업체 {snap.total ?? "-"}개
          </p>
          <p className="pt-0.5 font-mono text-[10px] text-blue-600">
            <span className="mr-1 font-sans font-semibold">N1</span>
            {snap.n1 !== null ? snap.n1.toFixed(6) : "-"}
          </p>
          <p className="font-mono text-[10px] text-orange-500">
            <span className="mr-1 font-sans font-semibold">N2</span>
            {snap.n2 !== null ? snap.n2.toFixed(6) : "-"}
          </p>
          <p className="font-mono text-[10px] text-gray-500">
            <span className="mr-1 font-sans font-semibold">N3</span>
            {snap.n3 !== null ? snap.n3.toFixed(6) : "-"}
          </p>
        </div>
      ) : (
        <div className="flex h-[120px] items-center justify-center text-sm text-gray-300">
          -
        </div>
      )}
    </div>
  );
}
