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
  createdAt: string;
  google_id: string;
  uid: string;
  verification_code: number;
  code_expires_at: string;
  isVerified: boolean;
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
}

export type { User, Eula, Game, GameRating, GameRatingRequest, Carousel };
