const express = require("express");
const { googleApiKey } = require("../config/db");
const { google } = require("googleapis");

const router = express.Router();

// 구글 API 설정
const youtube = google.youtube({
  version: "v3",
  auth: googleApiKey.youtubeApiKey, // 발급받은 API 키 입력
});

router.get("/get-videos/:channelId", async (req, res) => {
  const channelId = req.params.channelId;
  let videoIds = [];

  try {
    // 1. 채널 정보에서 'uploads' 재생목록 ID 가져오기
    const channelRes = await youtube.channels.list({
      part: "contentDetails",
      id: channelId,
    });

    const uploadsPlaylistId =
      channelRes.data.items[0].contentDetails.relatedPlaylists.uploads;

    // 2. 해당 재생목록의 모든 아이템 반복해서 가져오기 (Pagination)
    let nextPageToken = null;

    do {
      const playlistRes = await youtube.playlistItems.list({
        part: "snippet",
        playlistId: uploadsPlaylistId,
        maxResults: 50,
        pageToken: nextPageToken,
      });

      const items = playlistRes.data.items;
      items.forEach((item) => {
        videoIds.push(item.snippet.resourceId.videoId);
      });

      nextPageToken = playlistRes.data.nextPageToken;
    } while (nextPageToken);

    res.json({
      success: true,
      totalCount: videoIds.length,
      videoIds: videoIds,
    });
  } catch (error) {
    console.error("API 호출 중 오류 발생:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
