import express, { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { uploadGameImage, uploadDesyncFile } from "@/middleware/upload";

import { authMiddleware } from "@/middleware/auth"; // 인증 미들웨어 임포트
import { User } from "@/config/types";
import semver from "semver";

const router = express.Router();

const BASE_DL_PATH: string = "https://dl.prodbybitmap.com/download";

router.post("/game/image", authMiddleware, (req: Request, res: Response) => {
  const singleUpload = uploadGameImage.single("image");

  singleUpload(req, res, (err: any) => {
    if (err) return res.status(400).json({ message: err.message });

    const { gameBinaryName } = req.body;

    if (!gameBinaryName) {
      return res.status(400).json({ message: "invalid-gameBinaryName" });
    }

    if (!req.file) return res.status(400).json({ message: "nothing-uploaded" });

    const user = (req as any).user as User;

    return res.status(200).json({
      message: "업로드 성공!",
      filePath: `/uploads/game/${gameBinaryName}/${req.file.filename}`,
      uri: `${BASE_DL_PATH}/game/${gameBinaryName}/${req.file.filename}`,
      uploaderUid: user.uid,
    });
  });
});

router.post("/game/caidx", authMiddleware, (req: Request, res: Response) => {
  const singleUpload = uploadDesyncFile.single("desync");

  singleUpload(req, res, (err: any) => {
    if (err) return res.status(400).json({ message: err.message });

    const { gameId, platform, version } = req.body;

    if (!gameId) {
      return res.status(400).json({ message: "invalid-gameId" });
    }

    if (platform !== "Windows" || platform !== "macOS") {
      return res.status(400).json({ message: "invalid-platform" });
    }

    if (!version) {
      return res.status(400).json({ message: "invalid-version" });
    }

    if (!semver.valid(version)) {
      return res.status(400).json({ message: "invalid-semver-format" });
    }

    if (!req.file) return res.status(400).json({ message: "nothing-uploaded" });

    const fileName = `${platform}_${version}.caidx`;
    const relativePath = `uploads/game/caidx/${gameId}/${fileName}`;
    const absolutePath = path.join(process.cwd(), relativePath);

    if (fs.existsSync(absolutePath)) {
      return res.status(400).json({ message: "already-exists" });
    }

    const user = (req as any).user as User;
    // /game/caidx/0/Windows_v1.0.caidx
    return res.status(200).json({
      message: "업로드 성공!",
      filePath: `/${relativePath}`,
      uri: `${BASE_DL_PATH}/game/caidx/${gameId}/${fileName}`,
      uploaderUid: user.uid,
    });
  });
});

router.post("/avatar", authMiddleware, (req: Request, res: Response) => {
  const singleUpload = uploadGameImage.single("image");

  singleUpload(req, res, (err: any) => {
    if (err) return res.status(400).json({ message: err.message });

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "email을 입력해주세요." });
    }

    if (!req.file)
      return res.status(400).json({ message: "파일을 선택해주세요." });

    const user = (req as any).user as User;

    return res.status(200).json({
      message: "업로드 성공!",
      filePath: `/uploads/avatar/${(email as string).split("@")[0]}/${(email as string).split("@")[1]}/${req.file.filename}`,
      uri: `${BASE_DL_PATH}/avatar/${(email as string).split("@")[0]}/${(email as string).split("@")[1]}/${req.file.filename}`,
      uploaderUid: user.uid,
    });
  });
});

export default router;
