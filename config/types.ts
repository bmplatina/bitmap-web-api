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

export { User, Eula, Game };
