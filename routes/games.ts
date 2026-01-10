import express, { Request, Response } from "express";
import { gameDb } from "@/config/db";
import { Game } from "@/config/types";
import { ResultSetHeader } from "mysql2";

const router = express.Router();

// 모든 게임 데이터 가져오기 API
router.get("/released", async (req: Request, res: Response) => {
  try {
    const [results] = await gameDb.query("SELECT * FROM Games");
    res.json(results);
  } catch (err) {
    console.error("데이터 조회 중 오류:", err);
    res.status(500).send("서버 오류");
  }
});

// 등록을 대기 중인 게임
router.get("/pending", async (req: Request, res: Response) => {
  try {
    const [results] = await gameDb.query<Game[]>("SELECT * FROM GamesPending");
    res.json(results);
  } catch (err) {
    console.error("데이터 조회 중 오류:", err);
    res.status(500).send("서버 오류");
  }
});

// 데이터 삽입 API
router.post("/submit", async (req: Request, res: Response) => {
  const newGame = req.body;

  try {
    const [result] = await gameDb.query<ResultSetHeader>(
      "INSERT INTO GamesPending SET ?",
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
