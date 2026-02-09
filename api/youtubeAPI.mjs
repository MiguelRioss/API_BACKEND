import { JSDOM } from "jsdom";
import errors from "../errors/errors.mjs";
import handlerFactory from "../utils/handleFactory.mjs";

const DEFAULT_MAX_RESULTS = 12;
const CACHE_TTL_MS = 10 * 60 * 1000;

const cache = new Map();

function buildFeedUrl(channelId, playlistId) {
  if (playlistId) {
    return `https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(
      playlistId
    )}`;
  }
  if (channelId) {
    return `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(
      channelId
    )}`;
  }
  return "";
}

function getText(entry, selectors) {
  const list = Array.isArray(selectors) ? selectors : [selectors];
  for (const selector of list) {
    const node = entry.querySelector(selector);
    const text = node?.textContent?.trim();
    if (text) return text;
  }
  return "";
}

function parseFeed(xmlText, maxResults) {
  const dom = new JSDOM(xmlText, { contentType: "text/xml" });
  const doc = dom.window.document;
  if (doc.querySelector("parsererror")) {
    throw errors.externalService("Invalid YouTube feed XML");
  }

  return Array.from(doc.querySelectorAll("entry"))
    .slice(0, maxResults)
    .map((entry) => {
      const youtubeId = getText(entry, ["yt\\:videoId", "videoId"]);
      if (!youtubeId) return null;
      const title = getText(entry, "title");
      const description = getText(entry, [
        "media\\:description",
        "description",
      ]);
      const shareUrl =
        entry.querySelector("link")?.getAttribute("href") ||
        `https://www.youtube.com/watch?v=${youtubeId}`;
      const user = getText(entry, "author > name");
      const isShort = shareUrl.includes("/shorts/");
      return {
        id: youtubeId,
        youtubeId,
        title,
        description,
        user,
        shareUrl,
        isShort,
      };
    })
    .filter(Boolean);
}

function getCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry;
}

function setCache(key, items) {
  cache.set(key, { items, expiresAt: Date.now() + CACHE_TTL_MS });
}

async function fetchFeedXml(feedUrl) {
  const res = await fetch(feedUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; MesodoseBot/1.0; +https://mesodose.com)",
      Accept: "application/xml,text/xml",
    },
  });
  if (!res.ok) {
    throw errors.externalService(
      `Failed to fetch YouTube feed (${res.status} ${res.statusText})`
    );
  }
  return res.text();
}

export default function createYouTubeAPI() {
  return {
    getFeed: handlerFactory(internalGetFeed),
  };

  async function internalGetFeed(req, res) {
    const channelId = String(req.query.channelId || "").trim();
    const playlistId = String(req.query.playlistId || "").trim();
    const maxResultsRaw = Number.parseInt(req.query.maxResults, 10);
    const maxResults = Number.isFinite(maxResultsRaw)
      ? Math.max(1, Math.min(50, maxResultsRaw))
      : DEFAULT_MAX_RESULTS;

    const feedUrl = buildFeedUrl(channelId, playlistId);
    if (!feedUrl) {
      return errors.invalidData("channelId or playlistId is required.");
    }

    const cacheKey = `${feedUrl}|${maxResults}`;
    const cached = getCache(cacheKey);
    if (cached) {
      res.set("Cache-Control", "public, max-age=600");
      return {
        items: cached.items,
        cached: true,
        sourceUrl: feedUrl,
      };
    }

    const xmlText = await fetchFeedXml(feedUrl);
    const items = parseFeed(xmlText, maxResults);
    setCache(cacheKey, items);

    res.set("Cache-Control", "public, max-age=600");
    return {
      items,
      cached: false,
      sourceUrl: feedUrl,
    };
  }
}
