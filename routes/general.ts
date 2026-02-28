import express, { Request, Response } from "express";
import { bitmapDb } from "@/config/db";
import {
  Carousel,
  Eula,
  DocumentArchives,
  MembershipApplies,
  Portfolio,
  BitmapApp,
} from "@/config/types";

const router = express.Router();

router.get("/eula/:title", async (req: Request, res: Response) => {
  const { title } = req.params;

  try {
    const [rows] = await bitmapDb.query<Eula[]>(
      "SELECT ko, en FROM eula WHERE title = ?",
      [title],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "EULA not found" });
    }

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

router.get("/archive", async (req: Request, res: Response) => {
  try {
    const [results] = await bitmapDb.query<DocumentArchives[]>(
      "SELECT * FROM documentArchives",
    );

    res.json(results);
  } catch (error) {
    console.error("Database Error:", error);
    res.status(500).json({ error: "server-error" });
  }
});

router.get("/archive/:title", async (req: Request, res: Response) => {
  const { title } = req.params;

  try {
    const [rows] = await bitmapDb.query<DocumentArchives[]>(
      "SELECT * FROM documentArchives WHERE title = ?",
      [title],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Document not found" });
    }

    const doc = rows[0];

    res.json(doc);
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
  try {
    if (scope === "approved") {
      const [results] = await bitmapDb.query<MembershipApplies[]>(
        "SELECT * FROM membershipApplies WHERE isApproved = 1",
      );
      return res.json(results);
    } else if (scope === "all") {
      const [results] = await bitmapDb.query<MembershipApplies[]>(
        "SELECT * FROM membershipApplies",
      );
      return res.json(results);
    } else if (scope === "pending") {
      const [results] = await bitmapDb.query<MembershipApplies[]>(
        "SELECT * FROM membershipApplies WHERE isApproved = 0",
      );
      return res.json(results);
    }
    return res.status(400).send("invalid-method");
  } catch (err) {
    console.error("데이터 조회 중 오류:", err);
    return res.status(500).send("server-error");
  }
});

router.get("/portfolio/:uid", async (req: Request, res: Response) => {
  const { uid } = req.params;
  try {
    const [results] = await bitmapDb.query<Portfolio[]>(
      "SELECT * FROM portfolio WHERE uid = ?",
      [uid],
    );
    return res.json(results[0]);
  } catch (err) {
    console.error("데이터 조회 중 오류:", err);
    return res.status(500).send("server-error");
  }
});

router.get("/app", async (req: Request, res: Response) => {
  try {
    const [results] = await bitmapDb.query<BitmapApp[]>(
      "SELECT * FROM bitmapApp;",
    );
    return res.json(results[0]);
  } catch (err) {
    console.error("데이터 조회 중 오류:", err);
    return res.status(500).send("server-error");
  }
});

router.get("/app/:version", async (req: Request, res: Response) => {
  try {
    const { version } = req.params;
    const [results] = await bitmapDb.query<BitmapApp[]>(
      "SELECT * FROM bitmapApp WHERE version = ?",
      [version],
    );
    return res.json(results[0]);
  } catch (err) {
    console.error("데이터 조회 중 오류:", err);
    return res.status(500).send("server-error");
  }
});

router.get("/app/latest", async (req: Request, res: Response) => {
  try {
    const [results] = await bitmapDb.query<BitmapApp[]>(
      "SELECT * FROM bitmapApp ORDER BY id DESC LIMIT 1;",
    );
    return res.json(results[0]);
  } catch (err) {
    console.error("데이터 조회 중 오류:", err);
    return res.status(500).send("server-error");
  }
});

export default router;
