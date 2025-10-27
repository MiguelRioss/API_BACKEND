import errors from "../../errors/errors.mjs";

export default function createVideoUploadServices(database) {
    return {
        videoUploadService,
        getVideosMetadata,
        getVideoById
    }

    /**
     * Upload a video file to Firebase Storage.
     *
     * @param {Object} video - File object from multer or client.
     * @param {Buffer} video.buffer - File buffer.
     * @param {string} video.mimetype - MIME type (e.g. 'video/mp4').
     * @param {string} video.originalname - Original filename.
     * @returns {Promise<Object>} Uploaded video metadata.
     */
    async function videoUploadService(name ,description,city , country ,video) {
        // 1️⃣ Validate presence
        if (!video || !video.buffer) {
            throw errors.invalidData("No video file provided or invalid structure");
        }

        // 2️⃣ Validate MIME type
        const allowedTypes = ["video/mp4", "video/webm", "video/ogg", "video/quicktime"];
        if (!allowedTypes.includes(video.mimetype)) {
            throw errors.invalidData(
                `Invalid file type: ${video.mimetype}. Allowed types: ${allowedTypes.join(", ")}`
            );
        }

        // 3️⃣ Optional size check (if your framework provides size in bytes)
        const MAX_SIZE_MB = 200; // adjust as needed
        if (video.size && video.size > MAX_SIZE_MB * 1024 * 1024) {
            throw errors.invalidData(`File too large. Max size is ${MAX_SIZE_MB}MB`);
        }

        // 4️⃣ Upload to Firebase
        const videoUploaded = await database.uploadVideoToStorage(video);

        // 5️⃣ (Optional) Save metadata to DB
        await database.saveVideoMetadata({
            name : name, 
            description: description,
            city: city,
            country: country,
            id: videoUploaded.id,
            url: videoUploaded.url,
            filename: videoUploaded.filename,
            contentType: video.mimetype,
            isAutorized: null, // default to false; update later as needed
            uploadedAt: new Date().toISOString(),
        });

        return videoUploaded;
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