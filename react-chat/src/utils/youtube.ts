const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
export const VIDEO_PLAYER_MEDIA_QUERY = '(min-width: 768px)';

export function getYouTubeVideoId(url: string): string | null {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();
    let videoId: string | null = null;

    if (hostname === 'youtu.be') {
      videoId = parsedUrl.pathname.split('/').filter(Boolean)[0] ?? null;
    } else if (hostname === 'youtube.com' || hostname.endsWith('.youtube.com')) {
      if (parsedUrl.pathname === '/watch') {
        videoId = parsedUrl.searchParams.get('v');
      } else {
        const [route, pathVideoId] = parsedUrl.pathname.split('/').filter(Boolean);
        if (route === 'shorts' || route === 'embed' || route === 'live') {
          videoId = pathVideoId ?? null;
        }
      }
    }

    return videoId && YOUTUBE_VIDEO_ID_PATTERN.test(videoId) ? videoId : null;
  } catch {
    return null;
  }
}
