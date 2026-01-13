import errors from "../../errors/errors.mjs";
import {
  createPromoCodeForCertainTime,
  ensureString,
  ALLOWED_REASONS,
} from "../videoUploadServices/videoUploadServicesUtils.mjs";
import uploadVideoToYouTubeStep from "./uploadVideoToYouTubeStep.mjs";
const PROMO_CODE_DAYS = 30;

export default function createVideoUploadServices(
  database,
  emailService,
  promoCodeServices
) {
  return {
    videoUploadService,
    getVideosMetadata,
    getVideoById,
    acceptVideoService,
    declineVideoWithReason,
  };

  /**
   * Upload a video file to Firebase Storage.
   *
   * @param {Object} video - File object from multer or client.
   * @param {Buffer} video.buffer - File buffer.
   * @param {string} video.mimetype - MIME type (e.g. 'video/mp4').
   * @param {string} video.originalname - Original filename.
   * @returns {Promise<Object>} Uploaded video metadata.
   */
  async function videoUploadService(
    name,
    description,
    city,
    country,
    video,
    userEmail,
    userName
  ) {
    // 1️⃣ Validate presence
    if (!video || !video.buffer) {
      throw errors.invalidData("No video file provided or invalid structure");
    }

    // 2️⃣ Validate MIME type
    const allowedTypes = [
      "video/mp4",
      "video/webm",
      "video/ogg",
      "video/quicktime",
    ];
    if (!allowedTypes.includes(video.mimetype)) {
      throw errors.invalidData(
        `Invalid file type: ${
          video.mimetype
        }. Allowed types: ${allowedTypes.join(", ")}`
      );
    }

    // 3️⃣ Optional size check (if your framework provides size in bytes)
    const MAX_SIZE_MB = 200; // adjust as needed
    if (video.size && video.size > MAX_SIZE_MB * 1024 * 1024) {
      throw errors.invalidData(`File too large. Max size is ${MAX_SIZE_MB}MB`);
    }

    // 4️⃣ Upload to Firebase
    const videoUploaded = await database.uploadVideoToStorage(video);

    // 5️⃣ Prepare metadata with proper null/undefined handling
    const videoMetadata = {
      name: name || "",
      description: description || "",
      city: city || "",
      country: country || "",
      id: videoUploaded.id,
      url: videoUploaded.url || "",
      filename: videoUploaded.filename || "",
      contentType: video.mimetype || "",
      isAutorized: null,
      uploadedAt: new Date().toISOString(),
      // 👇 Add these two lines
      userEmail: userEmail || "",
    };

    console.log(
      "📋 Video metadata to save:",
      JSON.stringify(videoMetadata, null, 2)
    );

    // 6️⃣ Save metadata to DB
    await database.saveVideoMetadata(videoMetadata);

    // 7️⃣ Send emails (both user confirmation and admin notification)
    if (userEmail && emailService) {
      try {
        // Send confirmation email to user
        await emailService.sendSubmissionConfirmationEmail({
          userEmail,
          userName: userName || name || "Valued Customer",
        });
        console.log("✅ Submission confirmation email sent to:", userEmail);

        // Send admin notification email
        await emailService.sendAdminSubmissionNotification({
          userName: name || "Unknown User",
          userEmail: userEmail,
          city: city || "",
          country: country || "",
          submissionId: videoUploaded.id,
          consent: true, // Assuming consent is given when form is submitted
          submittedAt: new Date().toISOString(),
          fileName: video.originalname || "Unknown file",
          videoDuration: "Unknown", // You might need to extract this from the video
          thumbnailUrl: videoUploaded.url, // Using video URL as thumbnail for now
        });
        console.log(
          "✅ Admin notification email sent for submission:",
          videoUploaded.id
        );
      } catch (emailError) {
        console.error("❌ Failed to send email(s):", emailError);
        // Don't throw - email failure shouldn't break video upload
      }
    } else {
      console.log("⚠️ No emails sent - missing userEmail or emailService");
    }

    return videoUploaded;
  }

  async function acceptVideoService(videoID) {
    if (Number.isNaN(videoID)) {
      throw new Error("Need a valid Id for the video");
    }

    // Fetch the video
    const video = await database.getVideoById(videoID);
    if (!video) {
      throw new Error("Video not found");
    }

    // Update accept flag
    const videoChanged = { ...video, accept: true, status: "approved" };
    console.log(
      "📦 Video object from DB:",
      JSON.stringify(videoChanged, null, 2)
    );

    // Generate promo code
    const codeInitialProps = createPromoCodeForCertainTime(PROMO_CODE_DAYS);
    const validatedAndWithPromoCode = await promoCodeServices.createPromoCode(
      codeInitialProps
    );

    let approvalVideoUrl = video.url;

    try {
      const youtubeResult = await uploadVideoToYouTubeStep(video, {
        emailService,
      });
      if (youtubeResult?.youtubeVideoId) {
        const youtubeUrl =
          youtubeResult.youtubeUrl ||
          `https://youtu.be/${youtubeResult.youtubeVideoId}`;
        videoChanged.youtubeVideoId = youtubeResult.youtubeVideoId;
        videoChanged.youtubeUrl = youtubeUrl;
        videoChanged.url = youtubeUrl;
        approvalVideoUrl = youtubeUrl;
        videoChanged.youtubeUpload = {
          status: "uploaded",
          at: new Date().toISOString(),
        };
      } else if (youtubeResult?.skipped) {
        videoChanged.youtubeUpload = {
          status: "skipped",
          reason: youtubeResult.reason || "unknown",
          at: new Date().toISOString(),
        };
      }
    } catch (youtubeError) {
      console.warn(
        "[acceptVideoService] YouTube upload step failed:",
        youtubeError
      );
      videoChanged.youtubeUpload = {
        status: "failed",
        reason: youtubeError?.message || "unknown",
        at: new Date().toISOString(),
      };
    }

    await emailService.sendSubmissionApproval({
      userEmail: video.userEmail,
      userName: video.userName,
      voucherCode: validatedAndWithPromoCode.code,
      videoUrl: approvalVideoUrl,
    });

    return await database.patchVideo(videoID, videoChanged);
  }

  /**
   * Decline the video and delete from Metadata.
   *
   * @param {Object} videoID  - Video ID to be deleted.
   * @returns {Promise<Object>} Returning success deleted the video with ID.
   */
  async function declineVideoWithReason(videoID, reason, notes) {
    const id = typeof videoID === "string" ? videoID.trim() : videoID;
    if (!id && id !== 0)
      throw errors.invalidData("Need a valid Id for the video");

    // ✅ Validate inputs
    const safeReason = ensureString(reason, {
      name: "reason",
      required: true,
      max: 120,
      whitelist : ALLOWED_REASONS
    });
    
    const safeNotes = ensureString(notes, {
      name: "notes",
      required: false,
      max: 1000,
      allowEmpty: true,
    });

    const video = await database.getVideoById(id);
    if (video) {
      await emailService.sendSubmissionRejection({
        userEmail: video.userEmail,
        userName: video.userName || video.name || "Valued Customer",
        rejectionReason: safeReason,
        rejectionNotes: safeNotes, // empty string if none
        resubmitUrl: "https://mesodose.com/mesobuzz/upload",
      });
    }

    return await database.deleteVideoById(id);
  }

  /**
   * Get all the videos metadata file to Firebase Storage.
   * @returns {Promise<Object>} Uploaded video metadata.
   */
  async function getVideosMetadata() {
    const getVideosMetadata = await database.getAllVideos();
    return getVideosMetadata;
  }

  /**
   * Get all the videos metadata file to Firebase Storage.
   * @returns {Promise<Object>} Uploaded video metadata.
   */
  async function getVideoById(id) {
    const video = await database.getVideoById(id);
    return video;
  }
}
