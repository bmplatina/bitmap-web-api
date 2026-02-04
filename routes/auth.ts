import express, { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import passport from "passport"; // Passport 추가
import { Strategy as GoogleStrategy } from "passport-google-oauth20"; // 구글 전략 추가
import { v4 as uuidv4 } from "uuid";
import { bitmapDb, googleApiKey } from "@/config/db";
import sendMail from "@/middleware/mail";
import { User } from "@/config/types";
import { authMiddleware } from "@/middleware/auth";

const router = express.Router();

async function sendVerificationMail(
  locale: string,
  email: string,
  verificationCode: string,
) {
  const title =
    locale === "ko"
      ? "[Bitmap] 회원가입 인증 번호"
      : "[Bitmap] Verification Code for Sign Up";
  const message =
    locale === "ko"
      ? `인증 번호는 [${verificationCode}] 입니다. 10분 이내에 입력해 주세요.`
      : `Your verification code is [${verificationCode}]. Please enter it within 10 minutes.`;
  await sendMail(email, title, message);
}

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
        const [rows] = await bitmapDb.query<User[]>(
          "SELECT * FROM users WHERE google_id = ?",
          [profile.id],
        );
        let user = rows[0];

        // 2. 사용자가 없다면 회원가입 처리
        if (!user) {
          const newUid = uuidv4();
          const email = profile.emails?.[0]?.value ?? ""; // 이메일 추출

          await bitmapDb.query<User[]>(
            "INSERT INTO users (uid, username, email, google_id, isEmailVerified) VALUES (?, ?, ?, ?, ?)",
            [newUid, profile.displayName, email, profile.id, 1],
          );

          const [createdAccountQuery] = await bitmapDb.query<User[]>(
            "SELECT * FROM users WHERE google_id = ?",
            [profile.id],
          );

          return done(null, createdAccountQuery[0]);
        }

        return done(null, user);
      } catch (error) {
        return done(error, undefined);
      }
    },
  ),
);

// 3. 회원가입 API
router.post("/signup", async (req: Request, res: Response) => {
  try {
    const { locale = "ko", username, email, password, avatarUri } = req.body;

    if (!username || !password || !email) {
      return res.status(400).send("require-id-pw");
    }

    // 1. 6자리 인증 번호 생성 및 만료 시간(10분) 설정
    const verificationCode = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();
    const expiresAt = new Date(Date.now() + 10 * 60000);

    // 2. 고유 UID 생성
    const newUid = uuidv4();

    // 비밀번호 해싱 (Salt rounds: 10)
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. 사용자 정보 DB에 저장 (uid 컬럼 추가)
    await bitmapDb.query(
      "INSERT INTO users (uid, username, email, password, avatarUri, verification_code, code_expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        newUid,
        username,
        email,
        hashedPassword,
        avatarUri,
        verificationCode,
        expiresAt,
      ],
    );

    // 4. 이메일 발송
    await sendVerificationMail(locale, email, verificationCode);

    // 응답 시에도 id 대신 uid 반환
    return res
      .status(201)
      .send({ uid: newUid, username, message: "verification-code-sent" });
  } catch (error: any) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).send("username-exists");
    }
    console.error("============== SIGNUP ERROR ==============");
    console.error(error);
    console.error("==========================================");
    return res.status(500).send("server-error");
  }
});

// 10. 이메일 중복 확인 API
router.post("/signup/check-duplicate", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).send("require-email");
    }

    const [rows]: any = await bitmapDb.query(
      "SELECT 1 FROM users WHERE email = ? LIMIT 1",
      [email],
    );

    // 데이터가 있으면 중복(false), 없으면 사용 가능(true)
    const isAvailable = rows.length === 0;
    return res.status(200).json(isAvailable);
  } catch (error) {
    console.error(error);
    return res.status(500).send("server-error");
  }
});

// 4. 로그인 API
router.post("/login", async (req, res) => {
  try {
    const { email, password, bKeepLoggedIn } = req.body;

    if (!email || !password) {
      return res.status(400).send("require-id-pw");
    }

    // 사용자 조회 (조회 시 uid를 가져오는지 확인)
    const [rows] = await bitmapDb.query<User[]>(
      "SELECT * FROM users WHERE email = ?",
      [email],
    );
    const user = rows[0];

    if (!user) {
      return res.status(401).send("incorrect-id-pw");
    }

    // 이메일 인증 여부 확인
    // if (!user.isEmailVerified) {
    //   return res.status(403).send("email-not-verified");
    // }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).send("incorrect-id-pw");
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).send("server-configuration-error");
    }

    // 4. JWT 생성 시 id 대신 user.uid 사용
    const token = jwt.sign(
      {
        uid: user.uid,
        email: user.email,
        username: user.username,
        isAdmin: user.isAdmin,
        isDeveloper: user.isDeveloper,
        isTeammate: user.isTeammate,
        avatarUri: user.avatarUri,
        isEmailVerified: user.isEmailVerified,
      },
      secret,
      { expiresIn: bKeepLoggedIn ? "30d" : "6h" },
    );

    return res.status(200).json({ token });
  } catch (error) {
    console.error(error);
    return res.status(500).send("server-error");
  }
});

// 9. 인증 번호 확인 API
router.post("/email/verify", authMiddleware, async (req, res) => {
  const jwtUser = (req as any).user;
  try {
    const { code } = req.body;
    const email = jwtUser.email;

    if (!email || !code) {
      return res.status(400).send("require-email-code");
    }

    const [rows] = await bitmapDb.query<User[]>(
      "SELECT verification_code, code_expires_at FROM users WHERE email = ?",
      [email],
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
    await bitmapDb.query<User[]>(
      "UPDATE users SET verification_code = NULL, code_expires_at = NULL, isEmailVerified = 1 WHERE email = ?",
      [email],
    );

    return res.status(200).send("verified");
  } catch (error) {
    console.error(error);
    return res.status(500).send("server-error");
  }
});

// 인증 번호 발송 API
router.post("/email/send", authMiddleware, async (req, res) => {
  const jwtUser = (req as any).user;
  try {
    const { locale = "ko" } = req.body;
    const email = jwtUser.email;

    if (!email) {
      return res.status(400).send("require-email");
    }

    const [rows] = await bitmapDb.query<User[]>(
      "SELECT uid, username FROM users WHERE email = ?",
      [email],
    );
    const user = rows[0];

    if (!user) return res.status(404).send("user-not-found");
    if (user.isEmailVerified)
      return res.status(403).send("email-already-verified");

    // 1. 6자리 인증 번호 생성 및 만료 시간(10분) 설정
    const verificationCode = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();
    const expiresAt = new Date(Date.now() + 10 * 60000);

    // 3. 사용자 정보 DB에 저장 (uid 컬럼 추가)
    await bitmapDb.query(
      "UPDATE users SET verification_code = ?, code_expires_at = ? WHERE email = ?",
      [verificationCode, expiresAt, email],
    );

    // 4. 이메일 발송
    await sendVerificationMail(locale, email, verificationCode);

    // 응답 시에도 id 대신 uid 반환
    return res.status(201).send("email-sent");
  } catch (error) {
    console.error(error);
    return res.status(500).send("server-error");
  }
});

// ==========================================
// [추가] Google 로그인 라우트
// ==========================================

// 1. 로그인 시도: 사용자가 이 주소로 접속하면 구글 로그인 창으로 이동
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] }),
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

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).send("server-configuration-error");
    }

    const user = req.user as User;

    // 3. JWT 토큰 발급 (기존 /login 로직과 동일한 포맷)
    const token = jwt.sign(
      {
        uid: user.uid,
        email: user.email,
        username: user.username,
        isAdmin: user.isAdmin,
        isDeveloper: user.isDeveloper,
        isTeammate: user.isTeammate,
        avatarUri: user.avatarUri,
        isEmailVerified: user.isEmailVerified,
      },
      secret,
      // { expiresIn: "1h" }
    );

    // 4. 프론트엔드로 리다이렉트 (URL 쿼리 파라미터로 토큰 전달)
    const frontendUrl = process.env.FRONTEND_URL || "https://prodbybitmap.com";
    return res.redirect(`${frontendUrl}?token=${token}`);
  },
);

// 6. 보호된 라우트 (기존 코드 유지)
router.get("/profile", authMiddleware, (req, res) => {
  const user = (req as any).user;
  return res.json({
    uid: user.uid,
    email: user.email,
    username: user.username,
    isAdmin: user.isAdmin,
    isDeveloper: user.isDeveloper,
    isTeammate: user.isTeammate,
    avatarUri: user.avatarUri,
    isEmailVerified: user.isEmailVerified,
  });
});

router.post("/profile/query/:method", authMiddleware, async (req, res) => {
  const { method } = req.params;

  // 7. UID 기반으로 프로필 검색
  if (method === "uid") {
    try {
      const { uid } = req.body;

      if (!uid) {
        return res.status(400).send("require-uid");
      }

      // username과 email을 동시에 가져오는 쿼리
      const [rows] = await bitmapDb.query<User[]>(
        "SELECT username, email, avatarUri, id FROM users WHERE uid = ?",
        [uid],
      );

      const user = rows[0];

      if (!user) {
        return res.status(404).json({ message: "failed-query-by-uid" });
      }

      // 클라이언트에 두 정보 모두 전달
      return res.status(200).json({
        username: user.username,
        email: user.email,
        avatarUri: user.avatarUri,
        id: user.id,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).send("server-error");
    }
  }
  // 8. 토큰 검증 및 UID 반환 API
  else if (method === "token") {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).send("token-required");
      }

      const secret = process.env.JWT_SECRET;
      if (!secret) {
        return res.status(500).send("server-configuration-error");
      }

      const decoded = jwt.verify(token, secret) as any;
      return res.status(200).json({ uid: decoded.uid });
    } catch (error) {
      return res.status(401).send("invalid-token");
    }
  }
  return res.status(400).send("invalid-method");
});

router.post("/edit/:method", authMiddleware, async (req, res) => {
  const { method } = req.params;
  const jwtUser = (req as any).user;

  // 유저 이름 수정
  if (method === "username") {
    try {
      const { newUsername } = req.body;

      if (!newUsername) {
        return res.status(400).send("require-new-username");
      }

      await bitmapDb.query("UPDATE users SET username = ? WHERE uid = ?", [
        newUsername,
        jwtUser.uid,
      ]);
      return res.status(200).json({ message: "success" });
    } catch (error) {
      return res.status(401).send("invalid-token");
    }
  }
  // 비밀번호 수정
  else if (method === "password") {
    try {
      const { newPassword } = req.body;

      if (!newPassword) {
        return res.status(400).send("require-new-password");
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await bitmapDb.query("UPDATE users SET password = ? WHERE uid = ?", [
        hashedPassword,
        jwtUser.uid,
      ]);
      return res.status(200).json({ message: "success" });
    } catch (error) {
      return res.status(401).send("invalid-token");
    }
  }
  // 아바타 수정
  else if (method === "avatarUri") {
    try {
      const { newAvatarUri } = req.body;

      if (!newAvatarUri) {
        return res.status(400).send("require-new-avatarUri");
      }

      await bitmapDb.query("UPDATE users SET avatarUri = ? WHERE uid = ?", [
        newAvatarUri,
        jwtUser.uid,
      ]);
      return res.status(200).json({ message: "success" });
    } catch (error) {
      return res.status(401).send("invalid-token");
    }
  }
  return res.status(400).send("invalid-method");
});

export default router;
