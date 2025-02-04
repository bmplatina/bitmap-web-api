const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const dotenv = require('dotenv').config();
const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const tough = require('tough-cookie');

// Express 설정
const app = express();
const PORT = 3030;
const API_URL = "https://wiki.prodbybitmap.com/w/api.php";

// Axios
const jar = new tough.CookieJar();
const client = wrapper(axios.create({ jar }));

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
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = [
      /^https?:\/\/(.*\.)?prodbybitmap\.com(:\d+)?$/,  // 정규식 패턴 추가
      'https://prodbybitmap.com',
      'https://*.prodbybitmap.com',
      'http://localhost:5173',
      `http://localhost:${PORT}`
    ];

    // 정규식으로 검사 (some()을 사용해서 배열 내 정규식 체크)
    if (!origin || allowedOrigins.some(pattern => pattern instanceof RegExp ? pattern.test(origin) : pattern === origin)) {
      callback(null, true);  // CORS 허용
    } else {
      callback(new Error('Not allowed by CORS'));  // CORS 허용하지 않음
    }
  },
  credentials: true,  // 쿠키를 포함한 요청 허용
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  optionsSuccessStatus: 200 // 일부 브라우저에서 204 허용 안 하는 문제 해결
}));
app.use(express.json());

// CSRF 토큰까지 한 번에 받는 로그인 코드
app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    // 1. CSRF 토큰 요청
    const tokenRes = await client.get(`${API_URL}?action=query&meta=tokens&type=login&format=json`, {
      withCredentials: true,
    });

    const loginToken = tokenRes.data.query?.tokens?.logintoken;
    if (!loginToken) throw new Error("Failed to retrieve CSRF token");

    // 2. 로그인 요청 (쿠키 유지됨)
    const loginRes = await client.post(API_URL, new URLSearchParams({
      action: "login",
      format: "json",
      lgname: username,
      lgpassword: password,
      lgtoken: loginToken,
    }).toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      withCredentials: true,
    });

    res.json(loginRes.data);
  } catch (error) {
    res.status(500).json({ error: `Login request failed, ${error.message}` });
  }
});

// CSRF 토큰까지 한 번에 받는 가입 요청 (프록시)
app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, username, password } = req.body;

    // 1. CSRF 토큰 요청
    const tokenRes = await client.get(`${API_URL}?action=query&meta=tokens&type=createaccount&format=json`, {
      withCredentials: true,
    });

    const createAccountToken = tokenRes.data.query?.tokens?.createaccounttoken;
    if (!createAccountToken) throw new Error("Failed to retrieve CSRF token");

    const accountRes = await client.post(API_URL, new URLSearchParams({
      action: "createaccount",
      format: "json",
      username: username,
      password: password,
      retype: password,
      email: email,
      createreturnurl: "https://prodbybitmap.com/",
      createtoken: createAccountToken,
    }).toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      withCredentials: true,
    });

    const accountData = await accountRes.data;
    res.json(accountData);
  } catch (error) {
    res.status(500).json({ error: `Login request failed, ${error}` });
  }
});

// CSRF 토큰까지 한 번에 받는 로그아웃 요청 (프록시)
app.post("/api/auth/logout", async (req, res) => {
  try {
    const { email, username, password } = req.body;

    // 1. CSRF 토큰 요청
    const tokenRes = await client.get(`${API_URL}?action=query&meta=tokens&type=csrf&format=json`, {
      withCredentials: true,
    });

    const tokenData = tokenRes.data.query?.tokens?.csrftoken;
    if (!tokenData) throw new Error("Failed to retrieve CSRF token");

    const accountRes = await client.post(API_URL, new URLSearchParams({
      action: "logout",
      format: "json",
      username: username,
      password: password,
      retype: password,
      email: email,
      createreturnurl: "https://prodbybitmap.com/",
      createtoken: createAccountToken,
    }).toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        // Cookie:
      },
      withCredentials: true,
    });

    const accountData = await accountRes.data;
    res.json(accountData);
  } catch (error) {
    res.status(500).json({ error: `Login request failed, ${error}` });
  }
});

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