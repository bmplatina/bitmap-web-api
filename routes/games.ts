import express, { Request, Response } from "express";
import { bitmapDb } from "@/config/db";
import { Game } from "@/config/types";
import { ResultSetHeader } from "mysql2";
import { authMiddleware } from "@/middleware/auth";

const router = express.Router();

// 모든 게임 데이터 가져오기 API
router.get("/released", async (req: Request, res: Response) => {
  try {
    const [results] = await bitmapDb.query("SELECT * FROM games_list");
    res.json(results);
  } catch (err) {
    console.error("데이터 조회 중 오류:", err);
    res.status(500).send("서버 오류");
  }
});

// 등록을 대기 중인 게임
router.get("/pending", async (req: Request, res: Response) => {
  try {
    const [results] = await bitmapDb.query<Game[]>(
      "SELECT * FROM games_pending_list"
    );
    res.json(results);
  } catch (err) {
    console.error("데이터 조회 중 오류:", err);
    res.status(500).send("서버 오류");
  }
});

// 데이터 삽입 API
router.post("/submit", authMiddleware, async (req: Request, res: Response) => {
  const newGame = req.body;
  const jwtUser = (req as any).user;

  try {
    if (!jwtUser.isDeveloper) {
      throw Error("not-developer");
    }
    const [result] = await bitmapDb.query<ResultSetHeader>(
      "INSERT INTO games_pending_list SET ?",
      [newGame]
    );
    res.json({
      message: "새로운 게임이 추가되었습니다!",
      id: result.insertId,
    });
  } catch (err) {
    console.error("데이터 삽입 중 오류:", err);
    res.status(500).send("서버 오류");
  }
});

export default router;
