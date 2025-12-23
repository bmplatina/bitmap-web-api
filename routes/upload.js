const express = require("express");
const multer = require("multer");
const path = require("path");

const verifyToken = require("../middleware/auth"); // 인증 미들웨어 임포트

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
  storageImage: multer.diskStorage({
    destination: (req, file, cb) => {
      // 여기에 저장하고 싶은 경로를 입력합니다.
      // 주의: 해당 폴더가 서버에 미리 생성되어 있어야 합니다.
      cb(null, "uploads/images/");
    },
    filename: (req, file, cb) => {
      // 파일명 저장 방식 (중복 방지를 위해 타임스탬프 추가 권장)
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(
        null,
        file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
      );
    },
  }),
  fileFilter: fileFilterImage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB 제한 (바이트 단위)
  },
});

const fileFilterGameBinary = (req, file, cb) => {
  // 허용할 확장자 정규식
  const allowedTypes = /zip|exe|app/;
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
      new Error("지원되지 않는 파일 형식입니다. (zip, exe, app만 가능)"),
      false
    );
  }
};

const uploadGameBinary = multer({
  storageImage: multer.diskStorage({
    destination: (req, file, cb) => {
      // 여기에 저장하고 싶은 경로를 입력합니다.
      // 주의: 해당 폴더가 서버에 미리 생성되어 있어야 합니다.
      cb(null, "uploads/games/");
    },
    filename: (req, file, cb) => {
      // 파일명 저장 방식 (중복 방지를 위해 타임스탬프 추가 권장)
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(
        null,
        file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
      );
    },
  }),
  fileFilter: fileFilterGameBinary,
  limits: {
    fileSize: 25 * 1024 * 1024 * 1024, // 25GB 제한 (바이트 단위)
  },
});

router.post("/game/image", verifyToken, (req, res) => {
  const singleUpload = uploadImage.single("image");

  singleUpload(req, res, (err) => {
    // 1~3번 에러 핸들링 로직은 기존과 동일하게 유지

    if (err) return res.status(400).json({ message: err.message });
    if (!req.file)
      return res.status(400).json({ message: "파일을 선택해주세요." });

    // 추가: 인증된 유저의 정보를 활용할 수 있습니다.
    console.log("업로드한 유저 정보:", req.user);

    res.status(200).json({
      message: "업로드 성공!",
      filePath: `/uploads/${req.file.filename}`,
      uploaderId: req.user.id, // 응답에 포함하거나 DB 저장 시 활용
    });
  });
});

router.post("/game/binary", verifyToken, (req, res) => {
  const singleUpload = uploadGameBinary.single("image");

  singleUpload(req, res, (err) => {
    // 1~3번 에러 핸들링 로직은 기존과 동일하게 유지

    if (err) return res.status(400).json({ message: err.message });
    if (!req.file)
      return res.status(400).json({ message: "파일을 선택해주세요." });

    // 추가: 인증된 유저의 정보를 활용할 수 있습니다.
    console.log("업로드한 유저 정보:", req.user);

    res.status(200).json({
      message: "업로드 성공!",
      filePath: `/uploads/${req.file.filename}`,
      uploaderId: req.user.id, // 응답에 포함하거나 DB 저장 시 활용
    });
  });
});

module.exports = router;
