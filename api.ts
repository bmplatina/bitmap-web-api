// Bitmap Production Implemented API Features
// Coded by Platina

// 서버 모듈
import express from "express";
import http from "http";
import cors from "cors";
import dotenv from "dotenv";
import passport from "passport";
dotenv.config();

// 커스텀 모듈
import { initializeWebSocket } from "@/websockets/websocketHandler";
import generalRoutes from "@/routes/general";
import authRoutes from "@/routes/auth";
import gamesRoutes from "@/routes/games";
import notificationRoutes from "@/routes/notifications";
import uploadRoutes from "@/routes/upload";
import youtubeRoutes from "@/routes/youtube";
import eulaRoutes from "@/routes/eula";

// Express 설정
const app = express();
const server = http.createServer(app); // Express 앱으로 HTTP 서버 생성
const PORT = 3030;

// WebSocket 설정
initializeWebSocket(server);

app.set("strict routing", false);

app.use(
  cors({
    origin: "https://prodbybitmap.com",
    credentials: true, // 쿠키를 포함한 요청 허용
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    optionsSuccessStatus: 200, // 일부 브라우저에서 204 허용 안 하는 문제 해결
  }),
);

// JSON 파싱을 위한 미들웨어
app.use(express.json());
app.use(passport.initialize());

// 라우트 설정
app.use("/general", generalRoutes);
app.use("/auth", authRoutes);
app.use("/games", gamesRoutes);
app.use("/notify", notificationRoutes);
app.use("/upload", uploadRoutes);
app.use("/youtube", youtubeRoutes);
app.use("/eula", eulaRoutes);

// 서버 시작
server.listen(PORT, () => {
  console.log(
    `HTTP API와 WebSocket 서버가 http://localhost:${PORT} 에서 함께 실행 중`,
  );
});
