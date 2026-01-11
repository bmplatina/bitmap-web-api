import type { JwtPayload } from "jsonwebtoken";

// env.d.ts
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: "development" | "production";
      DB_HOST: string;
      DB_USER: string;
      DB_PASSWD: string;
      DB_SCHEMA: string;
      GOOGLE_CLIENT_ID: string;
      GOOGLE_CLIENT_SECRET: string;
      YOUTUBE_API_KEY: string;
      FRONTEND_URL: string;
      JWT_SECRET: string;
      ICLOUD_APP_PASSWD: string;
      ICLOUD_EMAIL: string;
      MASTER_TOKEN: string;
    }
  }
  namespace Express {}
}

export {};
