import { RowDataPacket } from "mysql2";

interface stringLocalized {
  en: string;
  ko: string;
}

interface User extends RowDataPacket {
  id: number;
  username: string;
  email: string;
  password: string;
  isAdmin: boolean;
  isDeveloper: boolean;
  isTeammate: boolean;
  avatarUri: string;
  createdAt: string;
  google_id: string;
  uid: string;
  verification_code: number;
  code_expires_at: string;
  isEmailVerified: boolean;
}

interface Eula extends RowDataPacket {
  title: string;
  ko: string;
  en: string;
}

interface Game extends RowDataPacket {
  gameId: number;
  isApproved: boolean;
  uid: string;
  gameTitle: string;
  gameLatestRevision: number;
  gamePlatformWindows: boolean;
  gamePlatformMac: boolean;
  gameEngine: string;
  gameGenre: stringLocalized;
  gameDeveloper: string;
  gamePublisher: string;
  isEarlyAccess: boolean;
  isReleased: boolean;
  gameReleasedDate: string;
  gameWebsite: string;
  gameVideoURL: string;
  gameDownloadMacURL: string | null;
  requirementsMac: string | null;
  gameDownloadWinURL: string | null;
  requirementsWindows: string | null;
  gameImageURL: string[];
  gameBinaryName: string;
  gameHeadline: stringLocalized;
  gameDescription: stringLocalized;
}

/**
 * 게임 평점 및 리뷰 데이터의 기본 구조
 */
interface GameRating extends RowDataPacket {
  id: number;
  gameId: number;
  uid: string; // DB의 uid (UUID)
  rating: number; // 1~5 또는 1~10 (tinyint 대응)
  title: string | null; // 제목은 없을 수도 있으므로 null 허용
  content: string; // DB의 body/text 대응
  createdAt: string; // ISO 8601 날짜 문자열
  updatedAt: string;
}

interface GameRatingRequest extends Omit<
  GameRating,
  "id" | "createdAt" | "updatedAt"
> {
  // 클라이언트에서 보낼 때는 이 데이터들만 포함됩니다.
}

interface Carousel extends RowDataPacket {
  id: number;
  image: string;
  title: stringLocalized;
  description: stringLocalized;
  href: string | null;
  button: stringLocalized;
}

interface BitmapMemberInfo extends RowDataPacket {
  id: number;
  name: string;
  channelId: string;
  avatarUrl: string;
  position: string;
}

interface MembershipApplies extends RowDataPacket {
  id: number;
  locale: string; // varchar(2)
  uid: string; // varchar(36) - 사용자 고유 식별자
  name: string; // varchar(20)
  alias: string; // varchar(20)
  age: number; // int
  introduction: string; // text
  motivation: string; // text
  affiliate: string; // text
  field: Array<string>; // json [number]
  prodTools: string; // text (기존 prodToold에서 변경)
  portfolio: string; // text
  youtubeHandle: string; // text
  avatarUri: string; // text
  position: string; // varchar(30)
  isApproved: boolean; // tinyint(1) (0 또는 1)
}

interface MembershipLeaveRequest extends RowDataPacket {
  id: number;
  locale: string; // varchar(2)
  uid: string; // varchar(36) - 사용자 고유 식별자
  leaveReason: string; // text
  satisfaction: number[]; // json [number]
}

// 알림 유형을 안전하게 관리하기 위한 Union Type
type NotificationType = "GAME_UPDATE" | "SYSTEM" | "PURCHASE" | string;

interface Notification extends RowDataPacket {
  id: number; // BIGINT -> number (2^53-1 이상은 string으로 처리하기도 함)
  uid: string; // 수신 대상 사용자 ID
  type: NotificationType; // 알림 유형 (문자열 리터럴로 상세 정의 추천)
  title: string; // 알림 제목
  content: string; // 알림 상세 내용
  redirectionUri?: string; // 클릭 시 이동 경로 (NULL 허용이므로 옵셔널)
  isRead: boolean; // 읽음 여부
  readAt: string | null; // 읽은 시간 (ISO string 또는 null)
  createdAt: string; // 생성 시간
}

interface DocumentArchives extends RowDataPacket {
  id: number;
  title: string;
  content: string;
  lastUpdatedAt: string;
}

interface Project {
  id: number;
  category: "dev" | "video";
  title: string;
  description: string;
  tags: string[];
  link: string;
  preview: string;
}

interface Portfolio extends RowDataPacket {
  uid: string; // varchar(36)
  position: string; // varchar(36)
  headline: string; // text
  stack: string; // text
  skills: string[]; // json (배열 형태일 경우)
  portfolioIntroduction: string; // text
  project: Project[]; // json (객체 배열 형태일 경우)
}

export type {
  User,
  Eula,
  Game,
  GameRating,
  GameRatingRequest,
  Carousel,
  BitmapMemberInfo,
  MembershipApplies,
  MembershipLeaveRequest,
  Notification,
  DocumentArchives,
  Portfolio,
};
