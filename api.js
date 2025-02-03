const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
const port = 3030;

// MySQL 연결 풀 설정
const db = mysql.createPool({
});

// JSON 파싱을 위한 미들웨어
app.use(express.json());
app.use(cors());

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
app.listen(port, () => {
  console.log(`서버가 http://localhost:${port} 에서 실행 중`);
});
