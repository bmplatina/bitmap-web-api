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
    user: process.env.ICLOUD_EMAIL, // 반드시 원래의 iCloud 계정 이메일을 넣으세요
    pass: process.env.ICLOUD_APP_PASSWD, // 생성한 앱 전용 비밀번호
  },
});

function sendMail(email: string, title: string, body: string, html: string) {
  // RTMP 이벤트 내부에서 호출할 전송 로직
  const mailOptions = {
    from: '"Bitmap" <public@prodbybitmap.com>', // 여기서 사용자 설정 도메인 사용 가능
    to: email,
    subject: title,
    text: body,
    html,
  };

  return transporter.sendMail(mailOptions);
}

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
  const html = locale === "ko" ? `` : ``;
  await sendMail(
    email,
    title,
    message,
    getVerificationHtml(locale, verificationCode),
  );
}

function getVerificationHtml(locale: string, verificationCode: string) {
  const bIsKorean: boolean = locale === "ko";

  const title: string = bIsKorean ? "Bitmap ID 메일 인증" : "Mail verification";

  const description: string = bIsKorean
    ? "서비스 이용을 위해 본인 확인이 필요합니다.<br />아래의 인증번호를 화면에 입력해주세요."
    : "Mail verification is required to use the service.<br />Please enter the verification code below on the screen.";

  const expireTime: string = bIsKorean
    ? "* 인증번호는 10분 동안 유효합니다.<br />* 본인이 요청하지 않았을 경우 비밀번호를 변경하십시오."
    : "* The verification code is valid for 10 minutes.<br />* If you did not request this, please change your password.";

  const copyright: string = bIsKorean
    ? "Copyright © 2026 Bitmap Production. 모든 권리 보유."
    : "Copyright © 2026 Bitmap Production. All Rights Reserved.";

  return `
    <div style="font-family: 'Pretendard', sans-serif; max-width: 500px; margin: 0 auto; padding: 40px 20px; border: 1px solid #eee; border-radius: 12px;">
      <div style="margin-bottom: 32px; text-align: center;">
        <img src="https://prodbybitmap.com/_next/static/media/bitmap_bmp.93518f1d.png" alt="Bitmap Logo" style="height: 32px; filter: brightness(0);" />
      </div>
      <h2 style="color: #333; margin-bottom: 24px;">${title}</h2>
      <p style="color: #666; font-size: 15px; line-height: 1.6;">
        ${description}
      </p>
      
      <div style="margin: 32px 0; padding: 20px; background-color: #f8f9fa; border-radius: 8px; text-align: center;">
        <span style="font-size: 32px; font-weight: bold; color: #2563eb; letter-spacing: 8px;">
          ${verificationCode}
        </span>
      </div>
      
      <p style="color: #999; font-size: 13px;">
        ${expireTime}
      </p>
      
      <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
      <p style="color: #bbb; font-size: 12px;">${copyright}</p>
    </div>
  `;
}

export { sendVerificationMail };
