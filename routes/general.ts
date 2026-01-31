import express, { Request, Response } from "express";
import { bitmapDb } from "@/config/db";
import { Carousel, Eula, MembershipApplies } from "@/config/types";

const router = express.Router();

router.get("/eula/:title", async (req: Request, res: Response) => {
  const { title } = req.params;

  try {
    // 1. [rows] 형태로 받아야 실제 데이터 배열에 접근할 수 있습니다.
    const [rows] = await bitmapDb.query<Eula[]>(
      "SELECT ko, en FROM eula WHERE title = ?",
      [title],
    );

    // 2. 검색 결과가 없을 경우 처리
    if (rows.length === 0) {
      return res.status(404).json({ error: "EULA not found" });
    }

    // 3. 첫 번째 행의 데이터 추출
    const { ko, en } = rows[0];

    res.json({
      ko: ko,
      en: en,
    });
  } catch (error) {
    console.error("Database Error:", error);
    res.status(500).json({ error: "server-error" });
  }
});

router.get("/carousel", async (req: Request, res: Response) => {
  try {
    const [results] = await bitmapDb.query<Carousel[]>(
      "SELECT * FROM carousel",
    );
    res.json(results);
  } catch (err) {
    console.error("데이터 조회 중 오류:", err);
    res.status(500).send("server-error");
  }
});

router.get("/members/:scope", async (req: Request, res: Response) => {
  const { scope } = req.params;
  if (scope === "approved") {
    try {
      const [results] = await bitmapDb.query<MembershipApplies[]>(
        "SELECT * FROM membershipApplies WHERE isApproved = 1",
      );
      res.json(results);
    } catch (err) {
      console.error("데이터 조회 중 오류:", err);
      res.status(500).send("server-error");
    }
  } else if (scope === "all") {
    try {
      const [results] = await bitmapDb.query<MembershipApplies[]>(
        "SELECT * FROM membershipApplies",
      );
      res.json(results);
    } catch (err) {
      console.error("데이터 조회 중 오류:", err);
      res.status(500).send("server-error");
    }
  } else if (scope === "pending") {
    try {
      const [results] = await bitmapDb.query<MembershipApplies[]>(
        "SELECT * FROM membershipApplies WHERE isApproved = 0",
      );
      res.json(results);
    } catch (err) {
      console.error("데이터 조회 중 오류:", err);
      res.status(500).send("server-error");
    }
  }
  return res.status(400).send("invalid-method");
});

export default router;
