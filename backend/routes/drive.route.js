const express = require("express");
const router = express.Router();
const { authenticateUser } = require("../middlewares/authentication.js");
const {
    presignedUrls,
    completeUpload,
    getFilesAndFolders,
    searchFilesAndFolders,
    getStarredFilesAndFolders,
    getTrashedFilesAndFolders,
    getFileDetails,
    downloadFile,
    createFolder,
    rename,
    shareFile,
    star,
    unstar,
    getFolders,
    move,
    makeFilePrivate,
    moveToTrash,
    restore,
    deletePermanently,
    getFilePreviewPublic,
    getFileDetailsPublic,
    downloadFilePublic,
} = require("../controllers/drive.controller.js");

router.post("/presigned-urls", authenticateUser, presignedUrls);
router.put("/complete-upload", authenticateUser, completeUpload);
router.get("/get/:id", authenticateUser, getFilesAndFolders);
router.get("/search", authenticateUser, searchFilesAndFolders);
router.get("/get-starred", authenticateUser, getStarredFilesAndFolders);
router.get("/get-trashed", authenticateUser, getTrashedFilesAndFolders);
router.get("/get-file/:id", authenticateUser, getFileDetails);
router.get("/download/:id", authenticateUser, downloadFile);
router.post("/create-folder", authenticateUser, createFolder);
router.put("/rename", authenticateUser, rename);
router.put("/star", authenticateUser, star);
router.put("/unstar", authenticateUser, unstar);
router.get("/get-folders/:id", authenticateUser, getFolders);
router.put("/move", authenticateUser, move);
router.put("/share-file/:id", authenticateUser, shareFile);
router.put("/make-file-private/:id", authenticateUser, makeFilePrivate);
router.put("/move-to-trash", authenticateUser, moveToTrash);
router.put("/restore", authenticateUser, restore);
router.delete("/delete", authenticateUser, deletePermanently);
router.get("/file-preview-public/:key", getFilePreviewPublic);
router.get("/get-file-public/:key", getFileDetailsPublic);
router.get("/download-public/:key", downloadFilePublic);

module.exports = router;