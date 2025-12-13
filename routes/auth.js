const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const passport = require("passport"); // Passport 추가
const GoogleStrategy = require("passport-google-oauth20").Strategy; // 구글 전략 추가
const { authDb } = require("../config/db");

const router = express.Router();

// ==========================================
// [추가] Passport Google Strategy 설정
// ==========================================
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/auth/google/callback", // 구글 콘솔에 등록한 리다이렉트 URI
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // 1. 구글 ID로 기존 사용자 검색
        const [rows] = await authDb.query(
          "SELECT * FROM users WHERE google_id = ?",
          [profile.id]
        );
        let user = rows[0];

        // 2. 사용자가 없다면 회원가입 처리 (DB 저장)
        if (!user) {
          const [result] = await authDb.query(
            "INSERT INTO users (username, google_id) VALUES (?, ?)",
            [profile.displayName, profile.id] // displayName은 구글 이름
          );
          user = { id: result.insertId, username: profile.displayName };
        }

        // 3. 사용자 정보를 passport로 넘김
        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

// ==========================================
// 기존 미들웨어 및 라우트
// ==========================================

// 5. 인증 미들웨어 (기존 코드 유지)
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send("인증 토큰이 필요합니다.");
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).send("유효하지 않은 토큰입니다.");
  }
};

// ... 기존 /signup, /login 라우트 생략 (그대로 사용) ...

// ==========================================
// [추가] Google 로그인 라우트
// ==========================================

// 1. 로그인 시도: 사용자가 이 주소로 접속하면 구글 로그인 창으로 이동
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// 2. 로그인 콜백: 구글 인증 완료 후 돌아오는 주소
router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: "/login",
  }),
  (req, res) => {
    // passport 전략(Strategy)이 성공하면 req.user에 사용자 정보가 담겨 있음

    // 3. JWT 토큰 발급 (기존 /login 로직과 동일한 포맷)
    const token = jwt.sign(
      { id: req.user.id, username: req.user.username },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // 4. 프론트엔드로 리다이렉트 (URL 쿼리 파라미터로 토큰 전달)
    // 주의: 실제 배포 시에는 보안을 위해 쿠키나 다른 방법을 고려해야 할 수 있습니다.
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    res.redirect(`${frontendUrl}?token=${token}`);
  }
);

// 6. 보호된 라우트 (기존 코드 유지)
router.get("/profile", authMiddleware, (req, res) => {
  res.send(
    `안녕하세요, ${req.user.username}님! 당신의 ID는 ${req.user.id}입니다.`
  );
});

module.exports = router;
