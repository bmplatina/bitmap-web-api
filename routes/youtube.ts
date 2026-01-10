import express, { Request, Response } from "express";
import { googleApiKey } from "@/config/db";
import { google } from "googleapis";

const router = express.Router();

// 구글 API 설정
const youtube = google.youtube({
  version: "v3",
  auth: googleApiKey.youtubeApiKey, // 발급받은 API 키 입력
});

router.get("/get-videos/:channelId", async (req: Request, res: Response) => {
  const channelId = req.params.channelId;
  let videoIds: string[] = []; // videoIds를 string 배열로 초기화

  try {
    // 1. 채널 정보에서 'uploads' 재생목록 ID 가져오기
    const channelRes = await youtube.channels.list({
      part: ["contentDetails"], // 배열로 전달
      id: [channelId], // 배열로 전달
    });

    // channelRes.data.items가 존재하고 비어있지 않은지 안전하게 확인
    const items = channelRes.data.items;
    if (!items || items.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Channel not found" });
    }

    const contentDetails = items[0].contentDetails;
    if (
      !contentDetails ||
      !contentDetails.relatedPlaylists ||
      !contentDetails.relatedPlaylists.uploads
    ) {
      return res
        .status(404)
        .json({ success: false, message: "Uploads playlist not found" });
    }

    const uploadsPlaylistId = contentDetails.relatedPlaylists.uploads;

    // 2. 해당 재생목록의 모든 아이템 반복해서 가져오기 (Pagination)
    let nextPageToken: string | undefined | null = undefined;

    do {
      // 명시적 any 캐스팅 또는 제네릭 사용으로 playlistRes 타입 문제 해결
      const playlistRes: any = await youtube.playlistItems.list({
        part: ["snippet"], // 배열로 전달
        playlistId: uploadsPlaylistId,
        maxResults: 50,
        pageToken: nextPageToken || undefined, // null 대신 undefined 사용
      });

      const playlistItems = playlistRes.data.items;
      if (playlistItems) {
        playlistItems.forEach((item: any) => {
          if (
            item.snippet &&
            item.snippet.resourceId &&
            item.snippet.resourceId.videoId
          ) {
            videoIds.push(item.snippet.resourceId.videoId);
          }
        });
      }

      nextPageToken = playlistRes.data.nextPageToken;
    } while (nextPageToken);

    res.json({
      success: true,
      totalCount: videoIds.length,
      videoIds: videoIds,
    });
  } catch (error: any) {
    console.error("API 호출 중 오류 발생:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
