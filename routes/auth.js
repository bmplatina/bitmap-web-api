const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const passport = require("passport"); // Passport 추가
const GoogleStrategy = require("passport-google-oauth20").Strategy; // 구글 전략 추가
const { v4: uuidv4 } = require("uuid");
const { authDb, googleApiKey } = require("../config/db");

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
          const newUid = uuidv4(); // 2. 고유한 UUID 생성 (예: '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed')

          await authDb.query(
            "INSERT INTO users (uid, username, google_id) VALUES (?, ?, ?)",
            [newUid, profile.displayName, profile.id] // 3. uid 컬럼에 저장
          );

          user = { uid: newUid, username: profile.displayName };
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

// 3. 회원가입 API
router.post("/signup", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !password || !email) {
      return res
        .status(400)
        .send("사용자 이름과 비밀번호를 모두 입력해주세요.");
    }

    // 2. 고유 UID 생성
    const newUid = uuidv4();

    // 비밀번호 해싱 (Salt rounds: 10)
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. 사용자 정보 DB에 저장 (uid 컬럼 추가)
    await authDb.query(
      "INSERT INTO users (uid, username, email, password) VALUES (?, ?, ?)",
      [newUid, username, email, hashedPassword]
    );

    // 응답 시에도 id 대신 uid 반환
    res.status(201).send({ uid: newUid, username });
  } catch (error) {
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
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .send("사용자 이름과 비밀번호를 모두 입력해주세요.");
    }

    // 사용자 조회 (조회 시 uid를 가져오는지 확인)
    const [rows] = await authDb.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);
    const user = rows[0];

    if (!user) {
      return res
        .status(401)
        .send("사용자 정보가 없거나 비밀번호가 일치하지 않습니다.");
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res
        .status(401)
        .send("사용자 정보가 없거나 비밀번호가 일치하지 않습니다.");
    }

    // 4. JWT 생성 시 id 대신 user.uid 사용
    const token = jwt.sign(
      { uid: user.uid, email: user.email }, // 페이로드 변경
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.status(200).json({ token });
  } catch (error) {
    console.error(error);
    res.status(500).send("서버 오류가 발생했습니다.");
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
      // { id: req.user.id, username: req.user.username },
      { uid: req.user.uid, username: req.user.username }, // id -> uid로 변경
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
  });
});

// 7. UID 기반으로 프로필 검색
router.post("/profile/query/uid", async (req, res) => {
  try {
    const { uid } = req.body;

    if (!uid) {
      return res.status(400).send("UID가 필요합니다.");
    }

    // username과 email을 동시에 가져오는 쿼리
    const [rows] = await authDb.query(
      "SELECT username, email FROM users WHERE uid = ?",
      [uid]
    );

    const user = rows[0];

    if (!user) {
      return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
    }

    // 클라이언트에 두 정보 모두 전달
    res.status(200).json({
      username: user.username,
      email: user.email,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("서버 오류가 발생했습니다.");
  }
});

module.exports = router;
