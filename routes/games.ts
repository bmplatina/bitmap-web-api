import express, { Request, Response } from "express";
import { bitmapDb } from "@/config/db";
import { Game } from "@/config/types";
import { ResultSetHeader } from "mysql2";
import { authMiddleware } from "@/middleware/auth";

const router = express.Router();

// 모든 게임 데이터 가져오기 API
router.get("/list", async (req: Request, res: Response) => {
  try {
    const [results] = await bitmapDb.query("SELECT * FROM games_list");
    res.json(results);
  } catch (err) {
    console.error("데이터 조회 중 오류:", err);
    res.status(500).send("서버 오류");
  }
});

// 모든 게임 데이터 가져오기 API
router.get("/list/uid", authMiddleware, async (req: Request, res: Response) => {
  const jwtUser = (req as any).user;
  try {
    const jwtUid = jwtUser.uid;
    const [results] = await bitmapDb.query(
      "SELECT * FROM games_list WHERE uid = ?",
      [jwtUid]
    );
    res.json(results);
  } catch (err) {
    console.error("데이터 조회 중 오류:", err);
    res.status(500).send("서버 오류");
  }
});

// 데이터 삽입 API
router.post("/submit", authMiddleware, async (req: Request, res: Response) => {
  const rawGameData: Game = req.body; // 프론트에서 받은 원본 데이터
  const jwtUser = (req as any).user;

  try {
    if (!jwtUser.isDeveloper) {
      throw Error("not-developer");
    }

    // DB에 넣기 위해 객체/배열 데이터를 JSON 문자열로 변환
    const dbGameData = {
      ...rawGameData,
      // 1. 다국어 객체(stringLocalized) -> JSON 문자열 변환
      gameGenre: JSON.stringify(rawGameData.gameGenre),
      gameHeadline: JSON.stringify(rawGameData.gameHeadline),
      gameDescription: JSON.stringify(rawGameData.gameDescription),

      // 2. 배열(string[]) -> JSON 문자열 변환
      gameImageURL: JSON.stringify(rawGameData.gameImageURL),

      // 3. (선택) DB가 AUTO_INCREMENT라면 gameId는 제외해야 할 수 있음
      // gameId: undefined
    };

    // 필요 없는 필드가 있다면 delete dbGameData.fieldName 으로 삭제

    const [result] = await bitmapDb.query<ResultSetHeader>(
      "INSERT INTO games_list SET ?",
      [dbGameData]
    );

    res.json({
      message: "succeed",
      id: result.insertId,
    });
  } catch (err: any) {
    console.error("데이터 삽입 중 오류:", err);
    res.status(500).send(err);
  }
});

// 게임 정보 수정 API
router.post("/edit", authMiddleware, async (req: Request, res: Response) => {
  const rawGameData: Game = req.body; // 프론트에서 받은 원본 데이터
  const jwtUser = (req as any).user;

  try {
    // 1. 개발자 권한 확인
    if (!jwtUser.isDeveloper) {
      throw Error("not-developer");
    }

    // 2. gameId 확인 (수정할 대상을 찾기 위해 필수)
    if (!rawGameData.gameId) {
      throw Error("수정할 게임의 gameId가 누락되었습니다.");
    }

    // 3. DB 저장을 위한 데이터 변환 (객체/배열 -> JSON 문자열)
    // submit 때와 동일하게 객체나 배열은 문자열로 바꿔줘야 에러가 안 납니다.
    const dbGameData = {
      ...rawGameData,
      gameGenre: JSON.stringify(rawGameData.gameGenre),
      gameHeadline: JSON.stringify(rawGameData.gameHeadline),
      gameDescription: JSON.stringify(rawGameData.gameDescription),
      gameImageURL: JSON.stringify(rawGameData.gameImageURL),
    };

    // 4. UPDATE 쿼리 실행
    // 구문: UPDATE 테이블명 SET ? WHERE 조건
    // dbGameData에 gameId가 포함되어 있어도 MySQL은 보통 문제없이 처리하지만,
    // 명확하게 하기 위해 WHERE 절 인자로 따로 빼줍니다.
    const [result] = await bitmapDb.query<ResultSetHeader>(
      "UPDATE games_list SET ? WHERE gameId = ?",
      [dbGameData, rawGameData.gameId]
    );

    // 5. 결과 확인
    if (result.affectedRows === 0) {
      // 쿼리는 성공했지만 조건에 맞는 gameId가 없어서 아무것도 안 바뀐 경우
      return res
        .status(404)
        .json({ message: "해당 gameId를 가진 게임을 찾을 수 없습니다." });
    }

    res.json({
      message: "게임 정보가 성공적으로 수정되었습니다!",
      gameId: rawGameData.gameId,
    });
  } catch (err: any) {
    console.error("데이터 수정 중 오류:", err);
    res.status(500).send(err.message);
  }
});

export default router;
