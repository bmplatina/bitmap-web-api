import nodemailer from "nodemailer";

if (!process.env.ICLOUD_APP_PASSWD) {
  console.error("========================================================");
  console.error("❌ [Mail Config] ICLOUD_APP_PASSWD 환경 변수가 없습니다.");
  console.error("   .env 파일을 확인하거나 환경 변수를 설정해주세요.");
  console.error("========================================================");
}

// 이메일 전송 객체 설정
const transporter = nodemailer.createTransport({
  host: "smtp.mail.me.com",
  port: 587,
  secure: false, // TLS 사용을 위해 false 설정 (587 포트)
  auth: {
    user: "ryuplatina@icloud.com", // 반드시 원래의 iCloud 계정 이메일을 넣으세요
    pass: process.env.ICLOUD_APP_PASSWD, // 생성한 앱 전용 비밀번호
  },
});

function sendMail(email: string, title: string, body: string) {
  // RTMP 이벤트 내부에서 호출할 전송 로직
  const mailOptions = {
    from: '"Bitmap" <public@prodbybitmap.com>', // 여기서 사용자 설정 도메인 사용 가능
    to: email,
    subject: title,
    text: body,
  };

  return transporter.sendMail(mailOptions);
}

export default sendMail;
