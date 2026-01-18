import express, { Request, Response } from "express";
import { bitmapDb } from "@/config/db";
import { Game, GameRating, GameRatingRequest } from "@/config/types";
import { ResultSetHeader } from "mysql2";
import { authMiddleware } from "@/middleware/auth";

const router = express.Router();

// 모든 게임 데이터 가져오기 API
router.get("/list", async (req: Request, res: Response) => {
  try {
    const [results] = await bitmapDb.query<Game[]>("SELECT * FROM games_list");
    res.json(results);
  } catch (err) {
    console.error("데이터 조회 중 오류:", err);
    res.status(500).send("server-error");
  }
});

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
router.post("/submit", authMiddleware, async (req: Request, res: Response) => {
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
router.post("/edit", authMiddleware, async (req: Request, res: Response) => {
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
    };

    // 2. SET 절에 포함되면 안 되는 필드 제거
    // delete dbGameData.gameId; // PK는 WHERE 절에서 사용하므로 SET에서 제외
    delete dbGameData.uid; // 소유자 변경 방지
    delete dbGameData.isApproved; // 승인 상태 임의 변경 방지 (필요 시)

    const [result] = await bitmapDb.query<ResultSetHeader>(
      "UPDATE games_list SET ? WHERE gameId = ?",
      [dbGameData, rawGameData.gameId],
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
  } catch (err) {
    console.error("평가 조회 중 오류:", err);
    res.status(500).send("server-error");
  }
});

// 평가 추가 API
router.post(
  "/rate/add",
  authMiddleware,
  async (req: Request, res: Response) => {
    const gameRate: GameRatingRequest = req.body;
    const jwtUser = (req as any).user;

    try {
      // 1. 본인 확인
      if (gameRate.uid !== jwtUser.uid)
        return res.status(403).json({ message: "not-author" });

      // 2. DB 입력용 객체 생성
      // (Omit을 썼더라도 spread 시 의도치 않은 필드가 들어가지 않도록 명시해주는 것이 안전합니다)
      const [result] = await bitmapDb.query<ResultSetHeader>(
        "INSERT INTO GameRating (gameId, uid, rate, title, body) VALUES (?, ?, ?, ?, ?)",
        [
          gameRate.gameId,
          gameRate.uid,
          gameRate.rate,
          gameRate.title,
          gameRate.body,
        ],
      );

      res.json({ message: "posted", id: result.insertId });
    } catch (err: any) {
      if (err.code === "ER_DUP_ENTRY") {
        return res.status(400).json({ message: "already-rated" });
      }
      res.status(500).json({ message: "server-error" });
    }
  },
);

// 평가 수정 API
router.post(
  "/rate/edit",
  authMiddleware,
  async (req: Request, res: Response) => {
    const { gameId, uid, ...updateFields }: GameRatingRequest = req.body;
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
      res.status(500).json({ message: "server-error" });
    }
  },
);

export default router;
