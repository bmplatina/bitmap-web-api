import express, { Request, Response } from "express";
import { bitmapDb } from "@/config/db";
import {
  Game,
  GameList,
  GameRating,
  GameRatingRequest,
  Playtime,
} from "@/config/types";
import { ResultSetHeader } from "mysql2";
import { authMiddleware } from "@/middleware/auth";
import { access, readdir, stat } from "fs/promises";
import path from "path";
import semver from "semver";

const router = express.Router();

const parseGameId = (gameId: string | string[] | undefined): number | null => {
  if (typeof gameId !== "string") return null;
  const parsed = Number(gameId);
  if (!Number.isInteger(parsed) || parsed < 0) return null;
  return parsed;
};

const parsePlaytime = (playtime: unknown): number | null => {
  if (typeof playtime !== "number") return null;
  if (
    !Number.isFinite(playtime) ||
    !Number.isInteger(playtime) ||
    playtime < 0
  ) {
    return null;
  }
  return playtime;
};

// 모든 게임 데이터 가져오기 API
router.get("/list", async (req: Request, res: Response) => {
  const { page } = req.query;
  const pageLimit = 8;

  try {
    const [results] = page
      ? // 페이지 값이 있으면 해당 오프셋만 보이기
        await bitmapDb.query<GameList[]>(
          "SELECT gameId, gameTitle, gameImageURL, gameDeveloper, gamePublisher, gameGenre, gameReleasedDate, isApproved, isEarlyAccess FROM games_list LIMIT ? OFFSET ?",
          [pageLimit, parseInt(page as string) * pageLimit],
        )
      : // 페이지 없이 전체 리스트를 가져오기
        await bitmapDb.query<GameList[]>(
          "SELECT gameId, gameTitle, gameImageURL, gameDeveloper, gamePublisher, gameGenre, gameReleasedDate, isApproved, isEarlyAccess FROM games_list",
        );

    return res.json(results);
  } catch (err: any) {
    console.error("데이터 조회 중 오류:", err);
    return res.status(500).json({ message: err.message || "server-error" });
  }
});

router.get("/pick/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const [results] = await bitmapDb.query<Game[]>(
      "SELECT * FROM games_list WHERE gameId = ?",
      [id],
    );

    if (!results || results.length === 0) {
      return res.status(404).json({ message: "Game not found" });
    }

    const game = results[0];
    const separator = "dl.prodbybitmap.com/download/";

    // URL에서 파일명(하위 경로)만 추출하는 헬퍼 함수
    const getRelPath = (url: string | null) => url?.split(separator)[1] || "";

    const relPathMac = getRelPath(game.gameDownloadMacURL);
    const relPathWin = getRelPath(game.gameDownloadWinURL);

    // process.cwd()를 사용하여 서버 실행 위치 기준 절대 경로 생성
    const uploadsDir = path.join(process.cwd(), "uploads");

    // 파일 정보를 가져오는 공통 로직 (파일이 없을 경우 대비)
    const getSafeSize = async (relPath: string) => {
      if (!relPath) return 0;
      try {
        const fullPath = path.join(uploadsDir, relPath);
        const stats = await stat(fullPath);
        return stats.size / 1024 ** 3; // GB 변환
      } catch {
        return 0; // 파일이 없으면 0으로 처리 (혹은 에러 처리)
      }
    };

    const [sizeWin, sizeMac] = await Promise.all([
      getSafeSize(relPathWin),
      getSafeSize(relPathMac),
    ]);

    const resultWithSize = {
      ...game,
      size: [parseFloat(sizeWin.toFixed(2)), parseFloat(sizeMac.toFixed(2))],
    };

    res.json(resultWithSize);
  } catch (err: any) {
    console.error("데이터 조회 중 오류:", err);
    res.status(500).json({ message: "server-error" });
  }
});

router.get(
  "/caidx/:gameId",
  authMiddleware,
  async (req: Request, res: Response) => {
    const { platform, version } = req.query;
    const { gameId } = req.params;

    if (!platform || !version) return res.status(400).send("field-required");

    const platformValue = Array.isArray(platform) ? platform[0] : platform;
    const versionValue = Array.isArray(version) ? version[0] : version;

    if (typeof platformValue !== "string" || typeof versionValue !== "string") {
      return res.status(400).send("invalid-field-type");
    }

    const platformRaw = platformValue;
    const versionRaw = versionValue;

    try {
      const fileDirectory = path.join(
        process.cwd(),
        "uploads",
        "game",
        "caidx",
        gameId.toString(),
      );
      const platformName =
        platformRaw.toLowerCase() === "windows"
          ? "Windows"
          : platformRaw.toLowerCase() === "macos"
            ? "macOS"
            : platformRaw;
      let fileName = `${platformName}_${versionRaw}.caidx`;

      if (versionRaw === "latest") {
        const files = await readdir(fileDirectory);
        const prefix = `${platformName}_`;
        const ext = ".caidx";

        const latestFile = files
          .filter((file) => file.startsWith(prefix) && file.endsWith(ext))
          .map((file) => {
            const rawVersion = file.slice(prefix.length, -ext.length);
            const coercedVersion = semver.coerce(rawVersion)?.version;
            return { file, coercedVersion };
          })
          .filter(
            (
              candidate,
            ): candidate is { file: string; coercedVersion: string } =>
              !!candidate.coercedVersion,
          )
          .sort((a, b) =>
            semver.rcompare(a.coercedVersion, b.coercedVersion),
          )[0];

        if (!latestFile) {
          return res.status(404).send("파일을 찾을 수 없습니다.");
        }

        fileName = latestFile.file;
      }

      const caidxAbsPath = path.join(fileDirectory, fileName);
      await access(caidxAbsPath);

      res.download(caidxAbsPath, (err) => {
        if (err) {
          if (res.headersSent) {
            // 이미 응답이 일부 전송된 경우 처리
            return;
          }
          res.status(404).send("파일을 찾을 수 없습니다.");
        }
      });
    } catch (err: any) {
      console.error("데이터 조회 중 오류:", err);
      res.status(500).json({ message: "server-error" });
    }
  },
);

// 모든 게임 데이터 가져오기 API
router.get("/list/uid", authMiddleware, async (req: Request, res: Response) => {
  const jwtUser = (req as any).user;
  try {
    const jwtUid = jwtUser.uid;
    const [results] = await bitmapDb.query<Game[]>(
      "SELECT * FROM games_list WHERE uid = ?",
      [jwtUid],
    );
    res.json(results);
  } catch (err) {
    console.error("데이터 조회 중 오류:", err);
    res.status(500).send("server-error");
  }
});

// 데이터 삽입 API (Submit)
router.post("/publish", authMiddleware, async (req: Request, res: Response) => {
  const rawGameData: Game = req.body;
  const jwtUser = (req as any).user;

  try {
    if (!jwtUser.isDeveloper) {
      throw Error("not-developer");
    }
    if (rawGameData.uid !== jwtUser.uid) {
      throw Error("not-author");
    }

    // 1. DB 저장을 위한 데이터 변환
    const dbGameData: any = {
      ...rawGameData,
      gameGenre: JSON.stringify(rawGameData.gameGenre),
      gameHeadline: JSON.stringify(rawGameData.gameHeadline),
      gameDescription: JSON.stringify(rawGameData.gameDescription),
      gameImageURL: JSON.stringify(rawGameData.gameImageURL),
      ratingContentDescriptors: JSON.stringify(
        rawGameData.ratingContentDescriptors,
      ),
      // 보안: 등록 시 uid는 토큰의 uid로 강제 설정
      uid: jwtUser.uid,
    };

    // 2. 불필요하거나 충돌을 일으키는 필드 제거
    // delete dbGameData.gameId; // AUTO_INCREMENT 충돌 방지

    const [result] = await bitmapDb.query<ResultSetHeader>(
      "INSERT INTO games_list SET ?",
      [dbGameData],
    );

    res.json({
      message: "submit-succeed",
      id: result.insertId,
    });
  } catch (err: any) {
    console.error("데이터 삽입 중 오류:", err);
    // 상세 에러 메시지 반환
    res.status(500).json({ message: err.message || "server-error" });
  }
});

// 게임 정보 수정 API (Edit)
router.put("/publish", authMiddleware, async (req: Request, res: Response) => {
  const rawGameData: Game = req.body;
  const jwtUser = (req as any).user;

  try {
    if (!jwtUser.isDeveloper) {
      throw Error("not-developer");
    }
    if (rawGameData.uid !== jwtUser.uid) {
      throw Error("not-author");
    }

    // 1. DB 저장을 위한 데이터 변환
    const dbGameData: any = {
      ...rawGameData,
      gameGenre: JSON.stringify(rawGameData.gameGenre),
      gameHeadline: JSON.stringify(rawGameData.gameHeadline),
      gameDescription: JSON.stringify(rawGameData.gameDescription),
      gameImageURL: JSON.stringify(rawGameData.gameImageURL),
      ratingContentDescriptors: JSON.stringify(
        rawGameData.ratingContentDescriptors,
      ),
    };

    // 2. SET 절에 포함되면 안 되는 필드 제거
    delete dbGameData.gameId; // PK는 WHERE 절에서 사용하므로 SET에서 제외
    delete dbGameData.uid; // 소유자 변경 방지
    delete dbGameData.isApproved; // 승인 상태 임의 변경 방지 (필요 시)

    const gameId = rawGameData.gameId;

    const columns = Object.keys(dbGameData);
    const values = Object.values(dbGameData);
    const setClause = columns.map((col) => `\`${col}\` = ?`).join(", ");

    const [result] = await bitmapDb.query<ResultSetHeader>(
      `UPDATE games_list SET ${setClause} WHERE gameId = ?`,
      [...values, gameId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "invalid-gameid" });
    }

    res.json({
      message: "edit-succeed",
      gameId: rawGameData.gameId,
    });
  } catch (err: any) {
    console.error("데이터 수정 중 오류:", err);
    // 상세 에러 메시지 반환 (SQL 에러 내용 포함)
    res.status(500).json({ message: err.message || "server-error" });
  }
});

// 게임별 평가 가져오기 API
router.get("/rate/:gameId", async (req: Request, res: Response) => {
  const { gameId } = req.params;

  try {
    const [results] = await bitmapDb.query<GameRating[]>(
      "SELECT * FROM GameRating WHERE gameId = ?",
      [gameId],
    );
    res.json(results);
  } catch (err: any) {
    console.error("평가 조회 중 오류:", err);
    res.status(500).json({ message: err.message || "server-error" });
  }
});

// 평가 추가 API
router.post(
  "/rate/:gameId",
  authMiddleware,
  async (req: Request, res: Response) => {
    const { gameId } = req.params;
    const gameRate: GameRatingRequest = req.body;
    const jwtUser = (req as any).user;

    try {
      // 1. 본인 확인
      if (gameRate.uid !== jwtUser.uid)
        return res.status(403).json({ message: "not-author" });

      // 2. DB 입력용 객체 생성
      // (Omit을 썼더라도 spread 시 의도치 않은 필드가 들어가지 않도록 명시해주는 것이 안전합니다)
      const [result] = await bitmapDb.query<ResultSetHeader>(
        "INSERT INTO GameRating (gameId, uid, rating, title, content) VALUES (?, ?, ?, ?, ?)",
        [
          gameId,
          gameRate.uid,
          gameRate.rating,
          gameRate.title,
          gameRate.content,
        ],
      );

      res.json({ message: "posted", id: result.insertId });
    } catch (err: any) {
      if (err.code === "ER_DUP_ENTRY") {
        return res.status(400).json({ message: "already-rated" });
      }
      res.status(500).json({ message: err.message || "server-error" });
    }
  },
);

// 평가 수정 API
router.put(
  "/rate/:gameId",
  authMiddleware,
  async (req: Request, res: Response) => {
    const { gameId } = req.params;
    const { uid, ...updateFields }: GameRatingRequest = req.body;
    const jwtUser = (req as any).user;

    try {
      if (uid !== jwtUser.uid)
        return res.status(403).json({ message: "not-author" });

      // updatedAt 추가
      const finalUpdateData = { ...updateFields, updatedAt: new Date() };

      const [result] = await bitmapDb.query<ResultSetHeader>(
        "UPDATE GameRating SET ? WHERE gameId = ? AND uid = ?",
        [finalUpdateData, gameId, uid],
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "not-found" });
      }

      res.json({ message: "updated" });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "server-error" });
    }
  },
);

// 평가 제거 API
router.delete(
  "/rate/:gameId",
  authMiddleware,
  async (req: Request, res: Response) => {
    const { gameId } = req.params;
    const jwtUser = (req as any).user;

    try {
      const [result] = await bitmapDb.query<ResultSetHeader>(
        "DELETE FROM GameRating WHERE gameId = ? AND uid = ?",
        [gameId, jwtUser.uid],
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "not-found" });
      }

      res.json({ message: "deleted" });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "server-error" });
    }
  },
);

router.get(
  "/playtime/:gameId",
  authMiddleware,
  async (req: Request, res: Response) => {
    const { gameId } = req.params;
    const parsedGameId = parseGameId(gameId);
    const jwtUser = (req as any).user;

    if (parsedGameId === null) {
      return res.status(400).json({ message: "invalid-field-type" });
    }

    try {
      const [result] = await bitmapDb.query<Playtime[]>(
        "SELECT * FROM games_playtime WHERE gameId = ? AND uid = ?",
        [parsedGameId, jwtUser.uid],
      );

      if (!result[0]) {
        return res.status(404).json({ message: "not-found" });
      }

      res.json(result[0]);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "server-error" });
    }
  },
);

router.post(
  "/playtime/:gameId",
  authMiddleware,
  async (req: Request, res: Response) => {
    const { gameId } = req.params;
    const { playtime } = req.body;
    const parsedGameId = parseGameId(gameId);
    const parsedPlaytime = parsePlaytime(playtime);
    const jwtUser = (req as any).user;

    if (parsedGameId === null) {
      return res.status(400).json({ message: "invalid-field-type" });
    }

    if (playtime === undefined) {
      return res.status(400).json({ message: "field-required" });
    }

    if (parsedPlaytime === null) {
      return res.status(400).json({ message: "invalid-field-type" });
    }

    try {
      const [checkExisting] = await bitmapDb.query<Playtime[]>(
        "SELECT * FROM games_playtime WHERE gameId = ? AND uid = ?",
        [parsedGameId, jwtUser.uid],
      );

      if (checkExisting.length > 0) {
        return res.status(400).json({ message: "already-exist" });
      }

      const [result] = await bitmapDb.query<ResultSetHeader>(
        "INSERT INTO games_playtime (gameId, uid, playtime) VALUES (?, ?, ?)",
        [parsedGameId, jwtUser.uid, parsedPlaytime],
      );

      res.json({
        message: "submit-succeed",
        id: result.insertId,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "server-error" });
    }
  },
);

router.put(
  "/playtime/:gameId",
  authMiddleware,
  async (req: Request, res: Response) => {
    const { gameId } = req.params;
    const { playtime } = req.body;
    const parsedGameId = parseGameId(gameId);
    const parsedPlaytime = parsePlaytime(playtime);
    const jwtUser = (req as any).user;

    if (parsedGameId === null) {
      return res.status(400).json({ message: "invalid-field-type" });
    }

    if (playtime === undefined) {
      return res.status(400).json({ message: "field-required" });
    }

    if (parsedPlaytime === null) {
      return res.status(400).json({ message: "invalid-field-type" });
    }

    try {
      const [result] = await bitmapDb.query<ResultSetHeader>(
        "UPDATE games_playtime SET playtime = ? WHERE gameId = ? AND uid = ?",
        [parsedPlaytime, parsedGameId, jwtUser.uid],
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "not-found" });
      }

      res.json({ message: "updated" });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "server-error" });
    }
  },
);

router.delete(
  "/playtime/:gameId",
  authMiddleware,
  async (req: Request, res: Response) => {
    const { gameId } = req.params;
    const parsedGameId = parseGameId(gameId);
    const jwtUser = (req as any).user;

    if (parsedGameId === null) {
      return res.status(400).json({ message: "invalid-field-type" });
    }

    try {
      const [result] = await bitmapDb.query<ResultSetHeader>(
        "DELETE FROM games_playtime WHERE gameId = ? AND uid = ?",
        [parsedGameId, jwtUser.uid],
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "not-found" });
      }

      res.json({ message: "deleted" });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "server-error" });
    }
  },
);

export default router;
