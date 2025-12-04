const mysql = require("mysql2/promise");
require("dotenv").config();

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

module.exports = { gameDb, authDb };
