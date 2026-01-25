import express, { Request, Response } from "express";
import { bitmapDb } from "@/config/db";
import { Carousel, BitmapMemberInfo } from "@/config/types";

const router = express.Router();

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

router.get("/members", async (req: Request, res: Response) => {
  try {
    const [results] = await bitmapDb.query<BitmapMemberInfo[]>(
      "SELECT * FROM team_members",
    );
    res.json(results);
  } catch (err) {
    console.error("데이터 조회 중 오류:", err);
    res.status(500).send("server-error");
  }
});

export default router;
