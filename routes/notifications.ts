import express, { Request, Response } from "express";
import { sendToUser } from "@/websockets/websocketHandler";
import type { Notification } from "@/config/types";
import { bitmapDb } from "@/config/db";
import { authMiddleware } from "@/middleware/auth";

const router = express.Router();

// 특정 사용자에게 알림을 보내는 API 엔드포인트
// router.post("/:uid", (req: Request, res: Response) => {
//   const { uid } = req.params;
//   const { title, body } = req.body;

//   if (!title || !body) {
//     return res
//       .status(400)
//       .json({ error: "title과 body를 모두 제공해야 합니다." });
//   }

//   const notificationPayload = JSON.stringify({ title, body });
//   const wasSent = sendToUser(uid, notificationPayload);

//   if (wasSent) {
//     res.status(200).json({
//       message: `'${uid}' 사용자에게 알림이 성공적으로 전송되었습니다.`,
//     });
//   } else {
//     res
//       .status(404)
//       .json({ error: `'${uid}' 사용자가 현재 연결되어 있지 않습니다.` });
//   }
// });

router.get(
  "/:scope",
  authMiddleware,
  async (req: Request<{ scope: string }>, res: Response) => {
    const { scope } = req.params;

    // 1. 커스텀 인터페이스를 사용하여 'any' 제거 (권장)
    const jwtUser = (req as any).user;

    if (jwtUser === "Master") {
      return res.status(403).json({ message: "master-token-denied" });
    }

    // 2. 유효한 scope 확인 및 파라미터 매핑 (Map 활용 시 더 깔끔함)
    const scopeMap: Record<string, number> = { unread: 0, read: 1, all: 2 };

    if (!(scope in scopeMap)) {
      return res.status(400).json({ message: "invalid-scope" });
    }

    try {
      const isAll = scope === "all";
      const scopeActionParam = scopeMap[scope];

      // 3. 쿼리와 파라미터를 변수로 분리하여 가독성 확보
      const query = `
      SELECT * FROM notifications 
      WHERE uid = ? ${isAll ? "" : "AND isRead = ?"}
      ORDER BY createdAt DESC
    `;

      const params = isAll ? [jwtUser.uid] : [jwtUser.uid, scopeActionParam];

      const [rows] = await bitmapDb.query<Notification[]>(query, params);

      if (rows.length === 0) {
        return res.status(404).json({ error: "not-found" });
      }

      res.json(rows);
    } catch (error) {
      console.error("Database Error:", error);
      res.status(500).json({ error: "server-error" });
    }
  },
);

export default router;
