import express, { Request, Response } from "express";
import { bitmapDb } from "@/config/db";
import { MembershipApplies, MembershipLeaveRequest } from "@/config/types";
import { authMiddleware } from "@/middleware/auth";

const router = express.Router();

router.post("/eula", authMiddleware, async (req: Request, res: Response) => {
  const { title, ko, en } = req.body;
  const jwtUser = (req as any).user;

  if (!jwtUser.isDeveloper) {
    return res.status(403).send("not-developer");
  }

  try {
    // 1. [rows] 형태로 받아야 실제 데이터 배열에 접근할 수 있습니다.
    await bitmapDb.query("INSERT INTO eula (title, ko, en) VALUES (?, ?, ?)", [
      title,
      ko,
      en,
    ]);

    res.json("eula-submitted");
  } catch (error) {
    console.error("Database Error:", error);
    res.status(500).json({ message: "server-error" });
  }
});

router.post(
  "/members/apply",
  authMiddleware,
  async (req: Request, res: Response) => {
    const {
      locale,
      name,
      alias,
      age,
      introduction,
      motivation,
      affiliate,
      field,
      prodTools,
      portfolio,
      youtubeHandle,
      avatarUri,
      position,
      uid,
    } = req.body;

    const jwtUser = (req as any).user;

    if (jwtUser.isTeammate) return res.status(403).send("already-teammate");

    try {
      await bitmapDb.query(
        "INSERT INTO membershipApplies (locale, name, alias, age, introduction, motivation, affiliate, field, prodTools, portfolio, youtubeHandle, avatarUri, position, uid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          locale,
          name,
          alias,
          age,
          introduction,
          motivation,
          affiliate,
          JSON.stringify(field),
          prodTools,
          portfolio,
          youtubeHandle,
          avatarUri,
          position,
          uid,
        ],
      );
      res.json({ message: "submitted" });
    } catch (err) {
      console.error("데이터 등록 중 오류:", err);
      res.status(500).json({ message: "server-error" });
    }
  },
);

router.get(
  "/members/apply",
  authMiddleware,
  async (req: Request, res: Response) => {
    const jwtUser = (req as any).user;

    if (!jwtUser.isAdmin) {
      return res.status(403).send("not-admin");
    }

    try {
      const [results] = await bitmapDb.query<MembershipApplies[]>(
        "SELECT * FROM membershipApplies WHERE isApproved = 0",
      );
      return res.json(results);
    } catch (err) {
      console.error("데이터 조회 중 오류:", err);
      return res.status(500).send("server-error");
    }
  },
);

router.get(
  "/members/apply/:id",
  authMiddleware,
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const jwtUser = (req as any).user;

    if (!jwtUser.isAdmin) {
      return res.status(403).send("not-admin");
    }

    try {
      const [rows] = await bitmapDb.query<MembershipApplies[]>(
        "SELECT * FROM membershipApplies WHERE id = ?",
        [id],
      );

      const leaveReq = rows[0];
      res.json(leaveReq);
    } catch (err) {
      console.error("데이터 등록 중 오류:", err);
      res.status(500).json({ message: "server-error" });
    }
  },
);

router.post(
  "/members/leave",
  authMiddleware,
  async (req: Request, res: Response) => {
    const { locale, uid, leaveReason, satisfaction } = req.body;
    const jwtUser = (req as any).user;

    if (!jwtUser.isAdmin) {
      return res.status(403).send("not-admin");
    }

    try {
      await bitmapDb.query(
        "INSERT INTO membershipLeaveRequest (locale, uid, leaveReason, satisfaction) VALUES (?, ?, ?, ?)",
        [locale, uid, leaveReason, JSON.stringify(satisfaction)],
      );
      res.json({ message: "submitted" });
    } catch (err) {
      console.error("데이터 등록 중 오류:", err);
      res.status(500).json({ message: "server-error" });
    }
  },
);

router.get(
  "/members/leave",
  authMiddleware,
  async (req: Request, res: Response) => {
    const jwtUser = (req as any).user;

    if (!jwtUser.isAdmin) {
      return res.status(403).send("not-admin");
    }

    try {
      const [results] = await bitmapDb.query<MembershipLeaveRequest[]>(
        "SELECT * FROM membershipLeaveRequest",
      );
      return res.json(results);
    } catch (err) {
      console.error("데이터 조회 중 오류:", err);
      return res.status(500).send("server-error");
    }
  },
);

router.get(
  "/members/leave/:id",
  authMiddleware,
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const jwtUser = (req as any).user;

    if (!jwtUser.isAdmin) {
      return res.status(403).send("not-admin");
    }

    try {
      const [rows] = await bitmapDb.query<MembershipLeaveRequest[]>(
        "SELECT * FROM membershipLeaveRequest WHERE id = ?",
        [id],
      );

      const leaveReq = rows[0];
      res.json(leaveReq);
    } catch (err) {
      console.error("데이터 등록 중 오류:", err);
      res.status(500).json({ message: "server-error" });
    }
  },
);

router.post(
  "/developer/apply",
  authMiddleware,
  async (req: Request, res: Response) => {
    const jwtUser = (req as any).user;

    if (jwtUser.isDeveloper) {
      return res.status(403).send("already-developer");
    }

    try {
      await bitmapDb.query("UPDATE users SET isDeveloper = ? WHERE uid = ?", [
        true,
        jwtUser.uid,
      ]);

      res.json({ message: "switched-to-developer" });
    } catch (err) {
      console.error("데이터 등록 중 오류:", err);
      res.status(500).json({ message: "server-error" });
    }
  },
);

export default router;
