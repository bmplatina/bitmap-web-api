const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { authDb } = require("../config/db");

const router = express.Router();

// 5. 인증 미들웨어
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send("인증 토큰이 필요합니다.");
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // 요청 객체에 사용자 정보 추가
    next();
  } catch (error) {
    res.status(401).send("유효하지 않은 토큰입니다.");
  }
};

router.post("/signup", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .send("사용자 이름과 비밀번호를 모두 입력해주세요.");
    }

    // 비밀번호 해싱 (Salt rounds: 10)
    const hashedPassword = await bcrypt.hash(password, 10);

    // 사용자 정보 DB에 저장
    const [result] = await authDb.query(
      "INSERT INTO users (username, password) VALUES (?, ?)",
      [username, hashedPassword]
    );

    res.status(201).send({ id: result.insertId, username });
  } catch (error) {
    // 사용자 이름이 중복될 경우 에러 발생
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).send("이미 존재하는 사용자 이름입니다.");
    }
    console.error(error);
    res.status(500).send("서버 오류가 발생했습니다.");
  }
});

// 4. 로그인 API
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .send("사용자 이름과 비밀번호를 모두 입력해주세요.");
    }

    // 사용자 조회
    const [rows] = await authDb.query(
      "SELECT * FROM users WHERE username = ?",
      [username]
    );
    const user = rows[0];

    if (!user) {
      return res
        .status(401)
        .send("사용자 정보가 없거나 비밀번호가 일치하지 않습니다.");
    }

    // 비밀번호 비교
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res
        .status(401)
        .send("사용자 정보가 없거나 비밀번호가 일치하지 않습니다.");
    }

    // JWT 생성
    const token = jwt.sign(
      { id: user.id, username: user.username }, // 토큰에 담을 정보
      process.env.JWT_SECRET, // 시크릿 키
      { expiresIn: "1h" } // 유효 기간 (1시간)
    );

    res.status(200).json({ token });
  } catch (error) {
    console.error(error);
    res.status(500).send("서버 오류가 발생했습니다.");
  }
});

// 6. 보호된 라우트 (인증된 사용자만 접근 가능)
router.get("/profile", authMiddleware, (req, res) => {
  // authMiddleware에서 추가한 사용자 정보를 사용
  res.send(
    `안녕하세요, ${req.user.username}님! 당신의 ID는 ${req.user.id}입니다.`
  );
});

module.exports = router;
