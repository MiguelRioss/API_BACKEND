import { getVideoById } from "../database/realDB/firebaseDB.mjs";
import handlerFactory from "../utils/handleFactory.mjs"

export default function createVideosAPI(videoUploadService) {
    return {
        uploadVideo: handlerFactory(internalUploadVideo),
        getVideosMetadata: handlerFactory(internalGetVideosMetadata),
        getVideoById: handlerFactory(internalGetVideoByID)
    }

    async function internalUploadVideo(req, res) {
        try {
            const videoFile = req.file; // multer puts single file here
            const videoName = req.body.name;
            const videoDescription = req.body.description;
            const videoCity = req.body.city;
            const videoCountry = req.body.country;
            console.log("Received video file:", videoFile?.originalname, videoFile?.mimetype, videoFile?.size);

            if (!videoFile) {
                return res.status(400).json({ success: false, message: "No video file uploaded" });
            }

            const result = await videoUploadService.videoUploadService(videoName,videoDescription,videoCity,videoCountry, videoFile);

            return res.status(200).json({
                success: true,
                message: "Video uploaded successfully",
                data: result,
            });
        } catch (err) {
            console.error("Upload error:", err);
            return res.status(500).json({ success: false, message: err.message || "Upload failed" });
        }
    }
    async function internalGetVideosMetadata(req, res) {
        return  videoUploadService.getVideosMetadata();
    }

     async function internalGetVideoByID(req, res) {
        const id  = req.params;
        return  videoUploadService.getVideoById(id);
    }

}