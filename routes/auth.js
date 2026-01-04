const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const passport = require("passport"); // Passport 추가
const GoogleStrategy = require("passport-google-oauth20").Strategy; // 구글 전략 추가
const { v4: uuidv4 } = require("uuid");
const { authDb, googleApiKey } = require("../config/db");
const sendMail = require("../middleware/mail");

const router = express.Router();

// ==========================================
// [추가] Passport Google Strategy 설정
// ==========================================
passport.use(
  new GoogleStrategy(
    {
      clientID: googleApiKey.googleClientId,
      clientSecret: googleApiKey.googleClientSecret,
      callbackURL: "/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // 1. 구글 ID로 기존 사용자 검색
        const [rows] = await authDb.query(
          "SELECT * FROM users WHERE google_id = ?",
          [profile.id]
        );
        let user = rows[0];

        // 2. 사용자가 없다면 회원가입 처리
        if (!user) {
          const newUid = uuidv4();
          const email = profile.emails?.[0]?.value; // 이메일 추출

          await authDb.query(
            "INSERT INTO users (uid, username, email, google_id, is_verified) VALUES (?, ?, ?, ?, ?)",
            [newUid, profile.displayName, email, profile.id, 1]
          );

          user = {
            uid: newUid,
            username: profile.displayName,
            email: email,
            isDeveloper: false,
            isTeammate: false,
          };
        }

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
    return res.status(401).send("token-required");
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).send("invalid-token");
  }
};

// 3. 회원가입 API
router.post("/signup", async (req, res) => {
  try {
    const {
      username,
      email,
      password,
      bIsDeveloper = false,
      bIsTeammate = false,
    } = req.body;

    if (!username || !password || !email) {
      return res.status(400).send("require-id-pw");
    }

    // 1. 6자리 인증 번호 생성 및 만료 시간(10분) 설정
    const verificationCode = Math.floor(
      100000 + Math.random() * 900000
    ).toString();
    const expiresAt = new Date(Date.now() + 10 * 60000);

    // 2. 고유 UID 생성
    const newUid = uuidv4();

    // 비밀번호 해싱 (Salt rounds: 10)
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. 사용자 정보 DB에 저장 (uid 컬럼 추가)
    await authDb.query(
      "INSERT INTO users (uid, username, email, password, isDeveloper, isTeammate, verification_code, code_expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        newUid,
        username,
        email,
        hashedPassword,
        bIsDeveloper,
        bIsTeammate,
        verificationCode,
        expiresAt,
      ]
    );

    // 4. 이메일 발송
    await sendMail(
      email,
      "[Bitmap] 회원가입 인증 번호",
      `인증 번호는 [${verificationCode}] 입니다. 10분 이내에 입력해 주세요.`
    );

    // 응답 시에도 id 대신 uid 반환
    res
      .status(201)
      .send({ uid: newUid, username, message: "verification-code-sent" });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).send("username-exists");
    }
    console.error("============== SIGNUP ERROR ==============");
    console.error(error);
    console.error("==========================================");
    res.status(500).send("server-error");
  }
});

// 4. 로그인 API
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).send("require-id-pw");
    }

    // 사용자 조회 (조회 시 uid를 가져오는지 확인)
    const [rows] = await authDb.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);
    const user = rows[0];

    if (!user) {
      return res.status(401).send("incorrect-id-pw");
    }

    // 이메일 인증 여부 확인
    if (!user.is_verified) {
      return res.status(403).send("email-not-verified");
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).send("incorrect-id-pw");
    }

    // 4. JWT 생성 시 id 대신 user.uid 사용
    const token = jwt.sign(
      {
        uid: user.uid,
        email: user.email,
        username: user.username,
        isDeveloper: user.isDeveloper,
        isTeammate: user.isTeammate,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.status(200).json({ token });
  } catch (error) {
    console.error(error);
    res.status(500).send("server-error");
  }
});

// 9. 인증 번호 확인 API
router.post("/verify-code", async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).send("require-email-code");
    }

    const [rows] = await authDb.query(
      "SELECT verification_code, code_expires_at FROM users WHERE email = ?",
      [email]
    );
    const user = rows[0];

    if (!user) return res.status(404).send("user-not-found");

    // 번호 일치 여부 확인
    if (user.verification_code !== code) {
      return res.status(400).send("invalid-code");
    }

    // 만료 시간 확인
    if (new Date() > new Date(user.code_expires_at)) {
      return res.status(400).send("code-expired");
    }

    // 인증 완료 처리
    await authDb.query(
      "UPDATE users SET verification_code = NULL, code_expires_at = NULL, is_verified = 1 WHERE email = ?",
      [email]
    );

    res.status(200).send("verified");
  } catch (error) {
    console.error(error);
    res.status(500).send("server-error");
  }
});

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
      {
        uid: req.user.uid,
        username: req.user.username,
        email: req.user.email,
        isDeveloper: req.user.isDeveloper,
        isTeammate: req.user.isTeammate,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // 4. 프론트엔드로 리다이렉트 (URL 쿼리 파라미터로 토큰 전달)
    // 주의: 실제 배포 시에는 보안을 위해 쿠키나 다른 방법을 고려해야 할 수 있습니다.
    const frontendUrl = process.env.FRONTEND_URL || "https://prodbybitmap.com";
    res.redirect(`${frontendUrl}?token=${token}`);
  }
);

// 6. 보호된 라우트 (기존 코드 유지)
router.get("/profile", authMiddleware, (req, res) => {
  res.json({
    uid: req.user.uid,
    username: req.user.username,
    email: req.user.email,
    isAdmin: req.user.isadmin,
    isDeveloper: req.user.isDeveloper,
    isTeammate: req.user.isTeammate,
  });
});

router.post("/profile/query/:method", async (req, res) => {
  const { method } = req.params;

  // 7. UID 기반으로 프로필 검색
  if (method === "uid") {
    try {
      const { uid } = req.body;

      if (!uid) {
        return res.status(400).send("require-uid");
      }

      // username과 email을 동시에 가져오는 쿼리
      const [rows] = await authDb.query(
        "SELECT username, email FROM users WHERE uid = ?",
        [uid]
      );

      const user = rows[0];

      if (!user) {
        return res.status(404).json({ message: "failed-query-by-uid" });
      }

      // 클라이언트에 두 정보 모두 전달
      res.status(200).json({
        username: user.username,
        email: user.email,
      });
    } catch (error) {
      console.error(error);
      res.status(500).send("server-error");
    }
  }
  // 8. 토큰 검증 및 UID 반환 API
  else if (method === "token") {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).send("token-required");
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      res.status(200).json({ uid: decoded.uid });
    } catch (error) {
      res.status(401).send("invalid-token");
    }
  }
});

module.exports = router;
