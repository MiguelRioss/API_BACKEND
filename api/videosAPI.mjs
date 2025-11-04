import { getVideoById } from "../database/realDB/firebaseDB.mjs";
import handlerFactory from "../utils/handleFactory.mjs";

export default function createVideosAPI(videoUploadService) {
  return {
    uploadVideo: handlerFactory(internalUploadVideo),
    getVideosMetadata: handlerFactory(internalGetVideosMetadata),
    getVideoById: handlerFactory(internalGetVideoByID),
    acceptVideo: handlerFactory(internalAcceptVideo),
    declineVideo: handlerFactory(internalDeclineVideo),
  };

  async function internalUploadVideo(req, res) {
    try {
      const videoFile = req.file;
      const { name, description, city, country, userEmail, userName } =
        req.body;

      // Debug logging
      console.log("📧 Email parameters received:");
      console.log("- userEmail:", userEmail);
      console.log("- userName:", userName);
      console.log("- name:", name);
      console.log("- city:", city);
      console.log("- country:", country);
      console.log("Video file:", videoFile?.originalname);

      if (!videoFile) {
        return res.status(400).json({
          success: false,
          message: "No video file uploaded",
        });
      }

      const result = await videoUploadService.videoUploadService(
        name,
        description,
        city,
        country,
        videoFile,
        userEmail,
        userName
      );

      return res.status(200).json({
        success: true,
        message: "Video uploaded successfully",
        data: result,
      });
    } catch (err) {
      console.error("Upload error:", err);
      return res.status(500).json({
        success: false,
        message: err.message || "Upload failed",
      });
    }
  }
  async function internalGetVideosMetadata(req, res) {
    return videoUploadService.getVideosMetadata();
  }

  async function internalGetVideoByID(req, res) {
    const id = req.params;
    return videoUploadService.getVideoById(id);
  }
  async function internalAcceptVideo(req, res) {
    try {
      const { id } = req.params;

      // Call the internal function
      const result = await videoUploadService.acceptVideoService(Number(id));

      res.status(200).json({
        success: true,
        message: "Video accepted successfully",
        data: result,
      });
    } catch (err) {
      console.error("Error accepting video:", err);
      res.status(500).json({
        success: false,
        message: err.message || "Failed to accept video",
      });
    }
  }

  async function internalDeclineVideo(req, res) {
    try {
      const { id } = req.params;
      const {reason , notes} = req.body
      
      const result = await videoUploadService.declineVideoWithReason(Number(id),reason,notes);
      res.status(200).json({
        success: true,
        message: "Video Was deleted",
        data: result,
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  }
}
