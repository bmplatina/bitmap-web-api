// Bitmap Production Implemented API Features
// Coded by Platina

// 서버 모듈
const express = require("express");
const http = require("http");

// MySQL 데이터베이스
const mysql = require("mysql2");
// const mysql = require('mysql2/promise');

require("dotenv").config();

// WebSocket
const { WebSocketServer } = require("ws");

// Auth
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const req = require("express/lib/request");

// Express 설정
const app = express();
const server = http.createServer(app); // Express 앱으로 HTTP 서버 생성
const PORT = 3030;

// WebSocket 설정
const wss = new WebSocketServer({ server }); // HTTP 서버에 WebSocket 서버 연결
const userConnections = new Map(); // userId와 ws 연결을 매핑

wss.on("connection", (ws) => {
  console.log("✅ 클라이언트가 연결되었습니다. 사용자 ID를 기다리는 중...");

  // 클라이언트로부터 첫 메시지(사용자 ID 등록)를 기다림
  ws.once("message", (message) => {
    try {
      const data = JSON.parse(message);
      // 메시지 타입이 'register'이고 userId가 있는지 확인
      if (data.type === "register" && data.userId) {
        const userId = data.userId;
        ws.userId = userId; // ws 객체에 userId를 저장하여 나중에 참조
        userConnections.set(userId, ws);
        console.log(`[등록] 사용자 ID '${userId}'가 연결되었습니다.`);

        // 사용자 ID 등록 후의 일반 메시지 핸들러
        ws.on("message", (regularMessage) => {
          console.log(`'${ws.userId}'로부터 메시지 수신: ${regularMessage}`);
        });
      } else {
        console.log("[오류] 잘못된 등록 메시지입니다. 연결을 종료합니다.");
        ws.close();
      }
    } catch (error) {
      console.error("첫 메시지 처리 중 오류:", error);
      ws.close();
    }
  });

  ws.on("close", () => {
    // ws 객체에 저장된 userId를 사용해 Map에서 제거
    if (ws.userId) {
      userConnections.delete(ws.userId);
      console.log(`[연결 종료] 사용자 ID '${ws.userId}'의 연결이 끊겼습니다.`);
    } else {
      console.log(
        "❌ 사용자 ID가 등록되지 않은 클라이언트의 연결이 끊겼습니다."
      );
    }
  });

  ws.on("error", (error) => {
    console.error("WebSocket 오류:", error);
    if (ws.userId) {
      userConnections.delete(ws.userId);
    }
  });
});

// 특정 사용자에게 메시지를 보내는 함수
function sendToUser(userId, message) {
  const userSocket = userConnections.get(userId);

  if (userSocket && userSocket.readyState === userSocket.OPEN) {
    console.log(`'${userId}'에게 메시지 발송: ${message}`);
    userSocket.send(message);
    return true; // 전송 성공
  } else {
    console.log(`'${userId}' 사용자를 찾을 수 없거나 연결이 끊겼습니다.`);
    return false; // 전송 실패
  }
}

// MySQL 연결 풀 설정
const gameDb = mysql.createPool({
  host: process.env.DB_HOST, // 데이터베이스 호스트
  user: process.env.DB_USER, // MySQL 사용자
  password: process.env.DB_PASSWD, // MySQL 비밀번호
  database: process.env.DB_GAMEDB, // 사용할 데이터베이스 이름
  waitForConnections: true,
  connectionLimit: 10, // 최대 연결 수
  queueLimit: 0, // 대기열 제한 없음
});

const authDb = mysql.createPool({
  host: process.env.DB_HOST, // 데이터베이스 호스트
  user: process.env.DB_USER, // MySQL 사용자
  password: process.env.DB_PASSWD, // MySQL 비밀번호
  database: process.env.DB_AUTHDB, // 사용할 데이터베이스 이름
  waitForConnections: true,
  connectionLimit: 10, // 최대 연결 수
  queueLimit: 0, // 대기열 제한 없음
});

/**
 * Auth
 */
app.post("/auth/signup", async (req, res) => {
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
app.post("/auth/login", async (req, res) => {
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

// 6. 보호된 라우트 (인증된 사용자만 접근 가능)
app.get("/auth/profile", authMiddleware, (req, res) => {
  // authMiddleware에서 추가한 사용자 정보를 사용
  res.send(
    `안녕하세요, ${req.user.username}님! 당신의 ID는 ${req.user.id}입니다.`
  );
});

/**
 * Games
 */

// 모든 게임 데이터 가져오기 API
app.get("/games", (req, res) => {
  const sql = "SELECT * FROM Games";
  gameDb.query(sql, (err, results) => {
    if (err) {
      console.error("데이터 조회 중 오류:", err);
      res.status(500).send("서버 오류");
      return;
    }
    res.json(results);
  });
});

// 등록을 대기 중인 게임
app.get("/games-pending", (req, res) => {
  const sql = "SELECT * FROM GamesPending";
  gameDb.query(sql, (err, results) => {
    if (err) {
      console.error("데이터 조회 중 오류:", err);
      res.status(500).send("서버 오류");
      return;
    }
    res.json(results);
  });
});

// 특정 사용자에게 알림을 보내는 API 엔드포인트
app.post("/notify/:userId", (req, res) => {
  const { userId } = req.params;
  const { title, body } = req.body;

  if (!title || !body) {
    return res
      .status(400)
      .json({ error: "title과 body를 모두 제공해야 합니다." });
  }

  const notificationPayload = JSON.stringify({ title, body });
  const wasSent = sendToUser(userId, notificationPayload);

  if (wasSent) {
    res.status(200).json({
      message: `'${userId}' 사용자에게 알림이 성공적으로 전송되었습니다.`,
    });
  } else {
    res
      .status(404)
      .json({ error: `'${userId}' 사용자가 현재 연결되어 있지 않습니다.` });
  }
});

// 데이터 삽입 API
app.post("/games/push", (req, res) => {
  const newGame = req.body;

  // 예: newGame이 { title: "Game1", genre: "Action" }와 같은 형식이라고 가정
  const sql = "INSERT INTO GamesPending SET ?";

  gameDb.query(sql, newGame, (err, result) => {
    if (err) {
      console.error("데이터 삽입 중 오류:", err);
      res.status(500).send("서버 오류");
      return;
    }
    res.json({
      message: "새로운 게임이 추가되었습니다!",
      id: result.insertId,
    });
  });
});

// 서버 시작
server.listen(PORT, () => {
  console.log(
    `HTTP API와 WebSocket 서버가 http://localhost:${PORT} 에서 함께 실행 중`
  );
});
