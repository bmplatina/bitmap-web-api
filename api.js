// Bitmap Production Implemented API Features
// Coded by Platina

// 서버 모듈
const express = require("express");
const http = require("http");
const cors = require("cors");
require("dotenv").config();

// 커스텀 모듈
const { initializeWebSocket } = require("./websockets/websocketHandler");
const authRoutes = require("./routes/auth");
const gamesRoutes = require("./routes/games");
const notificationRoutes = require("./routes/notifications");
const uploadRoutes = require("./routes/upload");
const youtubeRoutes = require("./routes/youtube");
const eulaRoutes = require("./routes/eula");

// Express 설정
const app = express();
const server = http.createServer(app); // Express 앱으로 HTTP 서버 생성
const PORT = 3030;

// WebSocket 설정
initializeWebSocket(server);

app.use(
  cors({
    origin: "https://prodbybitmap.com",
    credentials: true, // 쿠키를 포함한 요청 허용
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    optionsSuccessStatus: 200, // 일부 브라우저에서 204 허용 안 하는 문제 해결
  })
);

// JSON 파싱을 위한 미들웨어
app.use(express.json());

// 라우트 설정
app.use("/auth", authRoutes);
app.use("/games", gamesRoutes);
app.use("/notify", notificationRoutes);
app.use("/upload", uploadRoutes);
app.use("/youtube", youtubeRoutes);
app.use("/eula", eulaRoutes);

// 서버 시작
server.listen(PORT, () => {
  console.log(
    `HTTP API와 WebSocket 서버가 http://localhost:${PORT} 에서 함께 실행 중`
  );
});
