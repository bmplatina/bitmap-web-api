const express = require("express");
const multer = require("multer");
const path = require("path");

const router = express.Router();

// 이미지 파일 검증 로직 (확장자 체크)
const fileFilterImage = (req, file, cb) => {
  // 허용할 확장자 정규식
  const allowedTypes = /jpeg|jpg|png/;
  // 파일 확장자 확인
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase()
  );
  // MIME 타입 확인 (이중 보안)
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    // 거부 시 에러 메시지 전달
    cb(
      new Error("지원되지 않는 파일 형식입니다. (png, jpg, jpeg만 가능)"),
      false
    );
  }
};

const uploadImage = multer({
  storage: multer.diskStorage({
    /* 이전 답변의 storage 설정과 동일 */
  }),
  fileFilter: fileFilterImage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB 제한 (바이트 단위)
  },
});

router.post("/game/image", (req, res) => {
  const singleUpload = uploadImage.single("image");

  singleUpload(req, res, (err) => {
    // 1. 크기 제한 초과 에러 처리
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res
          .status(400)
          .json({ message: "파일 크기가 너무 큽니다. (최대 5MB)" });
      }
      return res.status(400).json({ message: err.message });
    }

    // 2. 확장자 불일치 등 사용자 정의 에러 처리
    else if (err) {
      return res.status(400).json({ message: err.message });
    }

    // 3. 파일이 없는 경우
    if (!req.file) {
      return res.status(400).json({ message: "파일을 선택해주세요." });
    }

    // 모든 검증 통과 후 성공 응답
    res.status(200).json({
      message: "업로드 성공!",
      filePath: `/uploads/${req.file.filename}`,
    });
  });
});

module.exports = router;
