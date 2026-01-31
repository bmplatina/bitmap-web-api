import multer, { FileFilterCallback } from "multer";
import { Request } from "express";
import path from "path";
import fs from "fs";

// 1. 폴더 생성 로직 (동기식 처리)
try {
  fs.readdirSync("uploads");
} catch (error) {
  console.error("uploads 폴더가 없어 생성합니다.");
  fs.mkdirSync("uploads");
}

// 2. 스토리지 설정 (타입 명시)
const storage = multer.diskStorage({
  destination: (
    req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, destination: string) => void,
  ) => {
    let uploadPath = "uploads/";

    // 게임 이미지: req.body.gameBinaryName을 사용하여 경로 설정
    if (req.body) {
      if (req.body.gameBinaryName) {
        uploadPath = path.join("uploads", "game", req.body.gameBinaryName);
      } else if (req.body.email) {
        uploadPath = path.join(
          "uploads",
          "avatar",
          (req.body.email as string).split("@")[0],
          (req.body.email as string).split("@")[1],
        );
      }
    }

    // 폴더가 없는 경우 생성 (recursive: true로 상위 폴더까지 생성)
    if (!fs.existsSync(uploadPath)) {
      try {
        fs.mkdirSync(uploadPath, { recursive: true });
      } catch (error) {
        console.error("폴더 생성 실패:", error);
      }
    }

    cb(null, uploadPath);
  },
  filename: (
    req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, filename: string) => void,
  ) => {
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);
    cb(null, `${basename}_${Date.now()}${ext}`);
  },
});

// 3. 파일 필터링 (선택 사항)
const fileFilterImage = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
) => {
  // 허용할 확장자 정규식
  const allowedTypes = /jpeg|jpg|png/;
  // 파일 확장자 확인
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase(),
  );
  // MIME 타입 확인 (이중 보안)
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    // 거부 시 에러 메시지 전달
    return cb(
      new Error(
        "지원되지 않는 파일 형식입니다. (png, jpg, jpeg만 가능)",
      ) as any,
      false,
    );
  }
};

// 4. Multer 인스턴스 생성 및 export
const uploadGameImage = multer({
  storage: storage,
  fileFilter: fileFilterImage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB 제한
});

export { uploadGameImage };
