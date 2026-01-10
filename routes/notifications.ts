import express, { Request, Response } from "express";
import { sendToUser } from "@/websockets/websocketHandler";

const router = express.Router();

// 특정 사용자에게 알림을 보내는 API 엔드포인트
router.post("/:userId", (req: Request, res: Response) => {
  const { userId } = req.params;
  const { title, body } = req.body;

  if (!title || !body) {
    return res
      .status(400)
      .json({ error: "title과 body를 모두 제공해야 합니다." });
  }

  const notificationPayload = JSON.stringify({ title, body });
  const wasSent = sendToUser(userId, notificationPayload);

  if (wasSent) {
    res.status(200).json({
      message: `'${userId}' 사용자에게 알림이 성공적으로 전송되었습니다.`,
    });
  } else {
    res
      .status(404)
      .json({ error: `'${userId}' 사용자가 현재 연결되어 있지 않습니다.` });
  }
});

export default router;
