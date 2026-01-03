const express = require("express");
const { authDb } = require("../config/db");

const router = express.Router();

router.get("/:title", async (req, res) => {
  const { title } = req.params;

  try {
    // 1. [rows] 형태로 받아야 실제 데이터 배열에 접근할 수 있습니다.
    const [rows] = await authDb.query(
      "SELECT ko, en FROM EULA WHERE title = ?",
      [title]
    );

    // 2. 검색 결과가 없을 경우 처리
    if (rows.length === 0) {
      return res.status(404).json({ error: "EULA not found" });
    }

    // 3. 첫 번째 행의 데이터 추출
    const { ko, en } = rows[0];

    res.json({
      ko: ko,
      en: en,
    });
  } catch (error) {
    console.error("Database Error:", error);
    res.status(500).json({ error: "server-error" });
  }
});

module.exports = router;
