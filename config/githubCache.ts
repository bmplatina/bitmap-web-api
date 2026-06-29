/**
 * GitHub Releases Cache Service
 *
 * GitHub API rate limit을 회피하기 위해 릴리즈 데이터를 메모리에 캐싱합니다.
 * 캐싱 주기: KST 00:00, 06:00, 12:00, 18:00 (6시간 간격)
 * 서버 시작 시 즉시 1회 fetch 후, 다음 스케줄 시간까지 타이머 설정
 */

import type { GitHubRelease } from "@/config/types";

const GITHUB_OWNER = "bmplatina";
const GITHUB_REPO = "bitmap-v0-nextron";
const GITHUB_API_BASE = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases`;

// 캐시 필드 — GitHubRelease 인터페이스에서 필요한 키만 추출
const RELEASE_FIELDS: (keyof GitHubRelease)[] = [
  "id",
  "url",
  "html_url",
  "tag_name",
  "target_commitish",
  "name",
  "body",
  "draft",
  "prerelease",
  "created_at",
  "published_at",
  "author",
  "assets",
  "tarball_url",
  "zipball_url",
];

/** pick 유틸: 원본 객체에서 필요한 키만 추출 */
function pickFields<T extends Record<string, unknown>>(
  obj: T,
  fields: string[],
): Partial<T> {
  const result: Record<string, unknown> = {};
  for (const key of fields) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result as Partial<T>;
}

// ── 캐시 저장소 ──────────────────────────────────────────────
let cachedReleases: GitHubRelease[] = [];
let lastFetchedAt: Date | null = null;
let schedulerTimer: ReturnType<typeof setTimeout> | null = null;
let intervalTimer: ReturnType<typeof setInterval> | null = null;

// ── GitHub API 호출 ──────────────────────────────────────────
function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "bitmap-web-api",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

async function fetchAllReleases(): Promise<GitHubRelease[]> {
  const allReleases: GitHubRelease[] = [];
  let page = 1;
  const perPage = 100; // GitHub API 최대 per_page

  while (true) {
    const url = `${GITHUB_API_BASE}?per_page=${perPage}&page=${page}`;
    const response = await fetch(url, { headers: buildHeaders() });

    if (!response.ok) {
      console.error(
        `[GitHubCache] 릴리즈 fetch 실패 (page ${page}): ${response.status} ${response.statusText}`,
      );
      break;
    }

    const data = (await response.json()) as Record<string, unknown>[];

    if (data.length === 0) break;

    const trimmed = data.map(
      (release) =>
        pickFields(release, RELEASE_FIELDS) as unknown as GitHubRelease,
    );
    allReleases.push(...trimmed);

    // 마지막 페이지면 종료
    if (data.length < perPage) break;
    page++;
  }

  return allReleases;
}

// ── 캐시 갱신 ────────────────────────────────────────────────
async function refreshCache(): Promise<void> {
  try {
    console.log("[GitHubCache] 릴리즈 캐시 갱신 시작...");
    const releases = await fetchAllReleases();
    cachedReleases = releases;
    lastFetchedAt = new Date();
    console.log(
      `[GitHubCache] 캐시 갱신 완료: ${releases.length}개 릴리즈 (${lastFetchedAt.toISOString()})`,
    );
  } catch (error) {
    console.error("[GitHubCache] 캐시 갱신 중 오류:", error);
  }
}

// ── 스케줄링 (KST 00, 06, 12, 18시) ─────────────────────────
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000; // UTC+9

/**
 * 다음 캐싱 시각(KST 00/06/12/18)까지 남은 ms를 계산합니다.
 */
function msUntilNextSchedule(): number {
  const now = new Date();
  // 현재 KST 시각
  const kstNow = new Date(now.getTime() + KST_OFFSET_MS);
  const kstHour = kstNow.getUTCHours();
  const kstMinute = kstNow.getUTCMinutes();
  const kstSecond = kstNow.getUTCSeconds();
  const kstMs = kstNow.getUTCMilliseconds();

  // 다음 스케줄 시각(KST) 계산: 0, 6, 12, 18 중 다음 것
  const scheduleHours = [0, 6, 12, 18];
  let nextKstHour = scheduleHours.find((h) => h > kstHour);

  let daysToAdd = 0;
  if (nextKstHour === undefined) {
    // 오늘 남은 스케줄이 없으면 내일 00시
    nextKstHour = 0;
    daysToAdd = 1;
  }

  // 현재 시각이 정확히 스케줄 시각인 경우 (분/초/ms가 0이 아닐 때만 현재 시각 사용)
  const currentSlotHour = scheduleHours.find((h) => h === kstHour);
  if (
    currentSlotHour !== undefined &&
    kstMinute === 0 &&
    kstSecond === 0 &&
    kstMs === 0
  ) {
    // 정확히 스케줄 시간이면 6시간 후
    return SIX_HOURS_MS;
  }

  // 다음 스케줄까지 남은 시간 계산
  const elapsedTodayMs =
    kstHour * 3600000 + kstMinute * 60000 + kstSecond * 1000 + kstMs;
  const nextScheduleMs =
    (nextKstHour + daysToAdd * 24) * 3600000;
  const remainingMs = nextScheduleMs - elapsedTodayMs;

  return remainingMs > 0 ? remainingMs : remainingMs + 24 * 3600000;
}

/**
 * 캐시 서비스를 초기화합니다.
 * 서버 시작 시 즉시 1회 fetch 후, KST 00/06/12/18시에 맞춰 주기적 갱신을 시작합니다.
 */
export async function initGitHubCache(): Promise<void> {
  // 즉시 1회 fetch
  await refreshCache();

  // 다음 스케줄 시각까지 대기 후 6시간 간격 반복
  const msToNext = msUntilNextSchedule();
  const nextTime = new Date(Date.now() + msToNext);
  console.log(
    `[GitHubCache] 다음 캐시 갱신 예정: ${nextTime.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} KST`,
  );

  // 기존 타이머 정리
  if (schedulerTimer) clearTimeout(schedulerTimer);
  if (intervalTimer) clearInterval(intervalTimer);

  schedulerTimer = setTimeout(() => {
    refreshCache();
    // 이후 6시간마다 반복
    intervalTimer = setInterval(refreshCache, SIX_HOURS_MS);
  }, msToNext);
}

// ── 캐시 접근 함수 ───────────────────────────────────────────

/** 캐싱된 모든 릴리즈를 반환합니다. */
export function getAllReleases(): GitHubRelease[] {
  return cachedReleases;
}

/** 최신 릴리즈 (prerelease/draft 제외)를 반환합니다. */
export function getLatestRelease(): GitHubRelease | undefined {
  return cachedReleases.find((r) => !r.draft && !r.prerelease);
}

/** 태그 이름으로 특정 릴리즈를 반환합니다. */
export function getReleaseByTag(tagName: string): GitHubRelease | undefined {
  return cachedReleases.find((r) => r.tag_name === tagName);
}

/** 마지막 캐시 갱신 시각을 반환합니다. */
export function getLastFetchedAt(): Date | null {
  return lastFetchedAt;
}
