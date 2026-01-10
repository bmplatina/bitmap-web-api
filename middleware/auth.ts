import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

const verifyToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN 형식

  if (!token) {
    return res.status(401).json({ message: "인증 토큰이 없습니다." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // 유저 정보를 req 객체에 저장
    next(); // 다음 미들웨어(multer 처리)로 이동
  } catch (err) {
    return res.status(403).json({ message: "유효하지 않은 토큰입니다." });
  }
};

const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send("token-required");
  }
  const token = authHeader.split(" ")[1];
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).send("server-configuration-error");
    }
    if (token === process.env.MASTER_TOKEN) {
      (req as any).user = "Master";
    } else {
      const decoded = jwt.verify(token, secret);
      (req as any).user = decoded;
    }

    next();
  } catch (error) {
    return res.status(401).send("invalid-token");
  }
};

export { authMiddleware, verifyToken };
