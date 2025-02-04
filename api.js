const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const dotenv = require('dotenv').config();

const app = express();
const PORT = 3030;
const API_URL = "https://wiki.prodbybitmap.com/w/api.php";

// MySQL 연결 풀 설정
const db = mysql.createPool({
  host: process.env.DB_HOST,      // 데이터베이스 호스트
  user: process.env.DB_USER,        // MySQL 사용자
  password: process.env.DB_PASSWD,      // MySQL 비밀번호
  database: process.env.DB_DBNAME, // 사용할 데이터베이스 이름
  waitForConnections: true,
  connectionLimit: 10,   // 최대 연결 수
  queueLimit: 0,         // 대기열 제한 없음
});

// JSON 파싱을 위한 미들웨어
app.use(express.json());
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = [/^https?:\/\/(.*\.)?prodbybitmap\.com(:\d+)?$/, 'http://localhost:5173', `http://localhost:${PORT}`]; // 여러 출처
    if (allowedOrigins.includes(origin) || !origin) {  // !origin은 서버 측에서 호출한 경우를 처리
      callback(null, true);  // CORS 허용
    } else {
      callback(new Error('Not allowed by CORS'));  // CORS 허용하지 않음
    }
  },
  credentials: true,  // 쿠키를 포함한 요청 허용
}));

// 모든 데이터 가져오기 API
app.get('/api/games', (req, res) => {
  const sql = 'SELECT * FROM Games';
  db.query(sql, (err, results) => {
    if (err) {
      console.error('데이터 조회 중 오류:', err);
      res.status(500).send('서버 오류');
      return;
    }
    res.json(results);
  });
});

// CSRF 토큰 가져오기 (프록시)
app.get("/api/auth/token", async (req, res) => {
  try {
    const { type } = req.query;

    if(!type) throw new Error("Invalid type");

    const tokenRes = await fetch(`${API_URL}?action=query&meta=tokens&type=${type}&format=json`, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });

    const tokenData = await tokenRes.json();
    res.json(tokenData);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch CSRF token" });
  }
});

// 로그인 요청 (프록시)
app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password, loginToken } = req.body;

    const loginRes = await fetch(API_URL, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        action: "login",
        format: "json",
        lgname: username,
        lgpassword: password,
        lgtoken: loginToken,
      }),
    });

    const loginData = await loginRes.json();
    res.json(loginData);
  } catch (error) {
    res.status(500).json({ error: "Login request failed" });
  }
});

// 가입 요청 (프록시)
app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, password, csrfToken } = req.body;

    const accountRes = await fetch(API_URL, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: new URLSearchParams({
        action: "createaccount",
        format: "json",
        username: username,
        password: password,
        retype: password,
        email: email,
        createreturnurl: "https://wiki.prodbybitmap.com/",
        token: csrfToken,
      }),
    });

    const accountData = await accountRes.json();
    res.json(accountRes);
  } catch (error) {
    res.status(500).json({ error: "Login request failed" });
  }
});

// 등록을 대기 중인 게임
app.get('/api/games-pending', (req, res) => {
    const sql = 'SELECT * FROM GamesPending';
    db.query(sql, (err, results) => {
      if (err) {
        console.error('데이터 조회 중 오류:', err);
        res.status(500).send('서버 오류');
        return;
      }
      res.json(results);
    });
  });

// 데이터 삽입 API
app.post('/api/games/push', (req, res) => {
  const newGame = req.body;

  // 예: newGame이 { title: "Game1", genre: "Action" }와 같은 형식이라고 가정
  const sql = 'INSERT INTO GamesPending SET ?';

  db.query(sql, newGame, (err, result) => {
    if (err) {
      console.error('데이터 삽입 중 오류:', err);
      res.status(500).send('서버 오류');
      return;
    }
    res.json({
      message: '새로운 게임이 추가되었습니다!',
      id: result.insertId,
    });
  });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`서버가 http://localhost:${PORT} 에서 실행 중`);
});