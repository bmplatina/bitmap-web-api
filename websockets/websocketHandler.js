const { WebSocketServer } = require("ws");

const userConnections = new Map(); // userId와 ws 연결을 매핑

function initializeWebSocket(server) {
  const wss = new WebSocketServer({ server }); // HTTP 서버에 WebSocket 서버 연결

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
            console.log(
              `'${ws.userId}'로부터 메시지 수신: ${regularMessage}`
            );
          });
        } else {
          console.log(
            "[오류] 잘못된 등록 메시지입니다. 연결을 종료합니다."
          );
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
        console.log(
          `[연결 종료] 사용자 ID '${ws.userId}'의 연결이 끊겼습니다.`
        );
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
}

// 특정 사용자에게 메시지를 보내는 함수
function sendToUser(userId, message) {
  const userSocket = userConnections.get(String(userId));

  if (userSocket && userSocket.readyState === userSocket.OPEN) {
    console.log(`'${userId}'에게 메시지 발송: ${message}`);
    userSocket.send(message);
    return true; // 전송 성공
  } else {
    console.log(`'${userId}' 사용자를 찾을 수 없거나 연결이 끊겼습니다.`);
    return false; // 전송 실패
  }
}

module.exports = { initializeWebSocket, sendToUser, userConnections };