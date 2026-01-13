import { randomUUID } from "node:crypto";

const TOKEN_REFRESH_SKEW_MS = 60 * 1000;
const DEFAULT_PRIVACY_STATUS = "public";
const DEFAULT_CATEGORY_ID = "22";

/**
 * MAIN ENTRY
 */
export default async function uploadVideoToYouTubeStep(
  video,
  { emailService } = {}
) {
  if (!video) {
    throw new Error("Video metadata is required for YouTube upload");
  }
  if (!video.url) {
    throw new Error("Video URL is required for YouTube upload");
  }

  const tokens = await loadTokens();
  const accessToken = await ensureAccessToken(tokens, { emailService });

  const videoBuffer = await downloadVideo(video.url);
  const metadata = buildMetadata(video);

  const uploadResponse = await uploadToYouTube({
    accessToken,
    metadata,
    contentType: video.contentType || "video/mp4",
    videoBuffer,
  });

  if (!uploadResponse?.id) {
    throw new Error("YouTube upload did not return a video id");
  }

  return {
    youtubeVideoId: uploadResponse.id,
    youtubeUrl: `https://youtu.be/${uploadResponse.id}`,
    response: uploadResponse,
  };
}

/**
 * TOKEN LOADING (ENV ONLY)
 */
async function loadTokens() {
  const refreshToken = process.env.YT_REFRESH_TOKEN;

  if (!refreshToken) {
    throw new Error("Missing YT_REFRESH_TOKEN env value");
  }

  return {
    refresh_token: refreshToken,
    token_type: "Bearer",
    scope: "https://www.googleapis.com/auth/youtube.upload",
  };
}

/**
 * ACCESS TOKEN HANDLING (STATELESS)
 */
function isTokenExpired(tokens) {
  const expiryDate = Number(tokens?.expiry_date || 0);
  if (!expiryDate) return true;
  return Date.now() >= expiryDate - TOKEN_REFRESH_SKEW_MS;
}

async function ensureAccessToken(tokens, { emailService } = {}) {
  if (tokens?.access_token && !isTokenExpired(tokens)) {
    return tokens.access_token;
  }

  const refreshed = await refreshAccessToken(tokens, { emailService });
  return refreshed.access_token;
}

/**
 * OAUTH REFRESH
 */
async function refreshAccessToken(tokens = {}, { emailService } = {}) {
  const refreshToken = tokens.refresh_token;
  const clientId = process.env.YT_CLIENT_ID;
  const clientSecret = process.env.YT_CLIENT_SECRET;

  console.log("YT_CLIENT_ID exists:", Boolean(clientId));
  console.log("YT_CLIENT_SECRET exists:", Boolean(clientSecret));
  console.log("Has refresh_token:", Boolean(refreshToken));

  if (!refreshToken) {
    throw new Error("Missing YouTube refresh_token for OAuth refresh");
  }
  if (!clientId || !clientSecret) {
    throw new Error("Missing YT_CLIENT_ID or YT_CLIENT_SECRET env values");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error("Google token refresh payload:", payload);
    if (payload?.error === "invalid_grant") {
      await notifyInvalidGrant({ emailService, payload });
    }
    throw new Error(
      `YouTube token refresh failed: ${
        payload?.error_description || payload?.error || "unknown error"
      }`
    );
  }

  const expiresIn = Number(payload.expires_in || 0);

  return {
    access_token: payload.access_token,
    token_type: payload.token_type || "Bearer",
    scope: payload.scope || tokens.scope,
    expiry_date: Date.now() + expiresIn * 1000,
  };
}

async function notifyInvalidGrant({ emailService, payload } = {}) {
  if (!emailService?.sendYouTubeTokenInvalidEmail) return;

  const errorCode = payload?.error || "invalid_grant";
  const errorDescription =
    payload?.error_description || "Token refresh rejected by Google.";

  try {
    await emailService.sendYouTubeTokenInvalidEmail({
      errorCode,
      errorDescription,
      occurredAt: new Date().toISOString(),
      environment: process.env.NODE_ENV || "unknown",
    });
  } catch (err) {
    console.error("[YouTube] Failed to send token alert email:", err);
  }
}

/**
 * VIDEO DOWNLOAD
 */
async function downloadVideo(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * METADATA
 */
function buildMetadata(video) {
  const title = sanitizeTitle(video.name || video.title || video.filename);
  const description = buildDescription(video);
  const categoryId = String(
    process.env.YT_CATEGORY_ID || DEFAULT_CATEGORY_ID
  );
  const privacyStatus =
    process.env.YT_PRIVACY_STATUS || DEFAULT_PRIVACY_STATUS;
  const madeForKids = String(process.env.YT_MADE_FOR_KIDS || "false") === "true";

  return {
    snippet: {
      title,
      description,
      categoryId,
    },
    status: {
      privacyStatus,
      selfDeclaredMadeForKids: madeForKids,
    },
  };
}

function sanitizeTitle(value) {
  const base = String(value || "Mesodose video submission").trim();
  if (!base) return "Mesodose video submission";
  return base.length > 100 ? `${base.slice(0, 97)}...` : base;
}

function buildDescription(video) {
  const parts = [];

  if (video.description) {
    parts.push(String(video.description).trim());
  }

  const location = [video.city, video.country]
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .join(", ");

  if (location) {
    parts.push(`Location: ${location}`);
  }

  if (video.userName) {
    parts.push(`Submitted by: ${String(video.userName).trim()}`);
  }

  const combined = parts.join("\n");

  if (!combined) {
    return "Mesodose video submission.";
  }

  return combined.length > 5000 ? `${combined.slice(0, 4997)}...` : combined;
}

/**
 * YOUTUBE UPLOAD
 */
async function uploadToYouTube({
  accessToken,
  metadata,
  contentType,
  videoBuffer,
}) {
  const boundary = `boundary_${randomUUID()}`;

  const jsonPart = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
      metadata
    )}\r\n`,
    "utf8"
  );

  const videoHeader = Buffer.from(
    `--${boundary}\r\nContent-Type: ${contentType}\r\nContent-Transfer-Encoding: binary\r\n\r\n`,
    "utf8"
  );

  const closing = Buffer.from(`\r\n--${boundary}--\r\n`, "utf8");

  const body = Buffer.concat([jsonPart, videoHeader, videoBuffer, closing]);

  const uploadUrl =
    "https://www.googleapis.com/upload/youtube/v3/videos" +
    "?uploadType=multipart&part=snippet,status";

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
      "Content-Length": String(body.length),
    },
    body,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      `YouTube upload failed: ${
        payload?.error?.message || payload?.error || "unknown error"
      }`
    );
  }

  return payload;
}
