const db = require("../config/db.js");
const CustomAPIError = require("../errors/custom.error.js");
const path = require("path");
const fs = require("fs").promises;
const crypto = require("crypto");
const moment = require("moment");
const mime = require("mime-types");
const { v4: uuid } = require("uuid");
const { encryptFile, decryptFile, bytesToSize } = require("../utils/drive.js");
const { previewFile } = require("../utils/preview.js");

const uploadFile = async (req, res) => {
    let { parent } = req.body;
    parent = parent && !isNaN(parseInt(parent)) ? parseInt(parent) : null;
    const user = req.user;

    if (!req.files || Object.keys(req.files).length === 0) {
        throw new CustomAPIError("No file uploaded", 400);
    }

    let files = req.files.files;
    if (!Array.isArray(files)) {
        files = Array.of(files);
    }

    const uploadPath = path.join(__dirname, `../private/${user.id}/`);
    await fs.mkdir(uploadPath, { recursive: true });

    const fileNames = files.map((f) => f.name);
    const [existingFileRows] = await db.execute(
        `SELECT name, original_name, size FROM files 
         WHERE owner = ? AND (parent = ? OR (? IS NULL AND parent IS NULL)) 
         AND original_name IN (${fileNames.map(() => "?").join(", ")}) AND is_deleted = false`,
        [user.id, parent, parent, ...fileNames],
    );

    const existingFileSizes = existingFileRows.reduce((sum, f) => sum + f.size, 0);
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    const totalStorage = user.current_storage + totalSize - existingFileSizes;

    if (totalStorage > user.max_storage) {
        throw new CustomAPIError(
            files.length > 1
                ? "The size of the files exceeds your storage limit"
                : "The size of the file exceeds your storage limit",
            400,
        );
    }

    const existingFilesMap = new Map(existingFileRows.map((f) => [f.original_name, f]));

    const conn = await db.getConnection();
    await conn.beginTransaction();

    try {
        await Promise.all(
            files.map(async (f) => {
                const existingFile = existingFilesMap.get(f.name);

                const encryptedFileName = existingFile ? existingFile.name : `${uuid()}.enc`;
                const encryptedFilePath = path.join(uploadPath, encryptedFileName);

                try {
                    await encryptFile(f.data, encryptedFilePath);
                } catch (err) {
                    throw new CustomAPIError("Something went wrong during encryption", 500);
                }

                const mimeType = mime.lookup(f.name) || "application/octet-stream";
                const type = mime.extension(mimeType) || "unknown";

                if (existingFile) {
                    await conn.execute(
                        `UPDATE files 
                         SET size = ?, mime_type = ?, type = ?, updated_at = NOW() 
                         WHERE owner = ? AND (parent = ? OR (? IS NULL AND parent IS NULL)) AND original_name = ? AND is_deleted = false`,
                        [f.size, mimeType, type, user.id, parent, parent, f.name],
                    );
                } else {
                    await conn.execute(
                        `INSERT INTO files (owner, parent, original_name, name, size, mime_type, type) 
                         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [user.id, parent, f.name, encryptedFileName, f.size, mimeType, type],
                    );
                }
            }),
        );

        await conn.execute(`UPDATE users SET current_storage = ? WHERE id = ?`, [totalStorage, user.id]);

        await conn.commit();
        res.status(201).json({
            currentStorage: totalStorage,
            message: "File uploaded successfully",
        });
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
};

const getFilesAndFolders = async (req, res) => {
    let parent = req.params.id;
    parent = parent && !isNaN(parseInt(parent)) ? parseInt(parent) : null;
    const user = req.user;

    let [files] = await db.execute(
        `SELECT id, parent, original_name, mime_type, type, is_starred, is_deleted, public_key 
         FROM files 
         WHERE owner = ? AND (parent = ? OR (? IS NULL AND parent IS NULL)) AND is_deleted = false`,
        [user.id, parent, parent],
    );

    let [folders] = await db.execute(
        `SELECT id, parent, name, is_starred, is_deleted 
         FROM folders 
         WHERE owner = ? AND (parent = ? OR (? IS NULL AND parent IS NULL)) AND is_deleted = false`,
        [user.id, parent, parent],
    );

    files =
        files.length === 0
            ? null
            : files.map((f) => ({
                  id: f.id,
                  parent: f.parent,
                  originalName: f.original_name,
                  mimeType: f.mime_type,
                  type: f.type,
                  isStarred: Boolean(f.is_starred),
                  isDeleted: Boolean(f.is_deleted),
                  publicKey: f.public_key,
              }));

    folders =
        folders.length === 0
            ? null
            : folders.map((f) => ({
                  id: f.id,
                  parent: f.parent,
                  name: f.name,
                  isStarred: Boolean(f.is_starred),
                  isDeleted: Boolean(f.is_deleted),
              }));

    res.status(200).json({ files, folders });
};

const searchFilesAndFolders = async (req, res) => {
    const { k } = req.query;
    const user = req.user;

    let [files] = await db.execute(
        `SELECT id, parent, original_name, mime_type, type, is_starred, is_deleted, public_key 
         FROM files 
         WHERE owner = ? AND is_deleted = false AND original_name LIKE ?`,
        [user.id, `${k}%`],
    );

    let [folders] = await db.execute(
        `SELECT id, parent, name, is_starred, is_deleted 
         FROM folders 
         WHERE owner = ? AND is_deleted = false AND name LIKE ?`,
        [user.id, `${k}%`],
    );

    files =
        files.length === 0
            ? null
            : files.map((f) => ({
                  id: f.id,
                  parent: f.parent,
                  originalName: f.original_name,
                  mimeType: f.mime_type,
                  type: f.type,
                  isStarred: Boolean(f.is_starred),
                  isDeleted: Boolean(f.is_deleted),
                  publicKey: f.public_key,
              }));

    folders =
        folders.length === 0
            ? null
            : folders.map((f) => ({
                  id: f.id,
                  parent: f.parent,
                  name: f.name,
                  isStarred: Boolean(f.is_starred),
                  isDeleted: Boolean(f.is_deleted),
              }));

    res.status(200).json({ files, folders });
};

const getStarredFilesAndFolders = async (req, res) => {
    const user = req.user;

    let [files] = await db.execute(
        `SELECT id, parent, original_name, mime_type, type, is_starred, is_deleted, public_key 
         FROM files 
         WHERE owner = ? AND is_starred = true AND is_deleted = false`,
        [user.id],
    );

    let [folders] = await db.execute(
        `SELECT id, parent, name, is_starred, is_deleted 
         FROM folders 
         WHERE owner = ? AND is_starred = true AND is_deleted = false`,
        [user.id],
    );

    files =
        files.length === 0
            ? null
            : files.map((f) => ({
                  id: f.id,
                  parent: f.parent,
                  originalName: f.original_name,
                  mimeType: f.mime_type,
                  type: f.type,
                  isStarred: Boolean(f.is_starred),
                  isDeleted: Boolean(f.is_deleted),
                  publicKey: f.public_key,
              }));

    folders =
        folders.length === 0
            ? null
            : folders.map((f) => ({
                  id: f.id,
                  parent: f.parent,
                  name: f.name,
                  isStarred: Boolean(f.is_starred),
                  isDeleted: Boolean(f.is_deleted),
              }));

    res.status(200).json({ files, folders });
};

const getTrashedFilesAndFolders = async (req, res) => {
    const user = req.user;

    let [files] = await db.execute(
        `SELECT id, parent, original_name, mime_type, type, is_starred, is_deleted, public_key 
         FROM files 
         WHERE owner = ? AND is_deleted = true`,
        [user.id],
    );

    let [folders] = await db.execute(
        `SELECT id, parent, name, is_starred, is_deleted 
         FROM folders 
         WHERE owner = ? AND is_deleted = true`,
        [user.id],
    );

    files =
        files.length === 0
            ? null
            : files.map((f) => ({
                  id: f.id,
                  parent: f.parent,
                  originalName: f.original_name,
                  mimeType: f.mime_type,
                  type: f.type,
                  isStarred: Boolean(f.is_starred),
                  isDeleted: Boolean(f.is_deleted),
                  publicKey: f.public_key,
              }));

    folders =
        folders.length === 0
            ? null
            : folders.map((f) => ({
                  id: f.id,
                  parent: f.parent,
                  name: f.name,
                  isStarred: Boolean(f.is_starred),
                  isDeleted: Boolean(f.is_deleted),
              }));

    res.status(200).json({ files, folders });
};

const getFileDetails = async (req, res) => {
    const fileId = parseInt(req.params.id);
    if (isNaN(fileId)) throw new CustomAPIError("File not found", 404);
    const user = req.user;

    const [rows] = await db.execute(
        `SELECT original_name, size, mime_type, type, is_starred, public_key, created_at, updated_at 
         FROM files WHERE id = ? AND owner = ?`,
        [fileId, user.id],
    );

    if (rows.length === 0) {
        throw new CustomAPIError("File not found", 404);
    }

    const file = rows[0];

    res.status(200).json({
        originalName: file.original_name,
        size: bytesToSize(file.size),
        mimeType: file.mime_type,
        type: file.type,
        isStarred: Boolean(file.is_starred),
        publicKey: file.public_key,
        createdAt: moment(file.created_at).format("LLLL"),
        updatedAt: moment(file.updated_at).format("LLLL"),
    });
};

const downloadFile = async (req, res) => {
    const fileId = parseInt(req.params.id);
    if (isNaN(fileId)) throw new CustomAPIError("File not found", 404);
    const user = req.user;

    const [rows] = await db.execute(
        `SELECT name, original_name, mime_type, owner FROM files WHERE id = ? AND owner = ?`,
        [fileId, user.id],
    );

    if (rows.length === 0) {
        throw new CustomAPIError("File not found", 404);
    }

    const file = rows[0];

    const uploadPath = path.join(__dirname, `../private/${user.id}/`);
    const encryptedFilePath = path.join(uploadPath, file.name);
    let buffer;

    try {
        buffer = await decryptFile(encryptedFilePath);
    } catch (err) {
        throw new CustomAPIError("Something went wrong", 500);
    }

    res.setHeader("Content-Disposition", `attachment; filename="${file.original_name}"`);
    res.type(file.mime_type);
    res.status(200).send(buffer);
};

const createFolder = async (req, res) => {
    let { name, parent } = req.body;
    parent = parent && !isNaN(parseInt(parent)) ? parseInt(parent) : null;
    const user = req.user;

    if (!name) {
        throw new CustomAPIError("Please provide a name", 400);
    }

    const [rows] = await db.execute(
        `SELECT id FROM folders 
         WHERE owner = ? AND (parent = ? OR (? IS NULL AND parent IS NULL)) AND name = ? AND is_deleted = false 
         LIMIT 1`,
        [user.id, parent, parent, name],
    );

    if (rows.length > 0) {
        throw new CustomAPIError("There is already a folder with the same name in this directory", 400);
    }

    const [result] = await db.execute(`INSERT INTO folders (owner, parent, name) VALUES (?, ?, ?)`, [
        user.id,
        parent,
        name,
    ]);

    res.status(201).json({
        folder: {
            id: result.insertId,
            parent: parent,
            name,
            isStarred: false,
        },
        message: "Folder created successfully",
    });
};

const rename = async (req, res) => {
    let { id, name, type } = req.body;
    const targetId = parseInt(id);
    const user = req.user;

    if (!name || isNaN(targetId)) {
        throw new CustomAPIError("Please provide valid id and name", 400);
    }

    let message;
    if (type === "file") {
        const [rows] = await db.execute(
            `SELECT parent, original_name FROM files WHERE id = ? AND owner = ? AND is_deleted = false`,
            [targetId, user.id],
        );

        if (rows.length === 0) {
            throw new CustomAPIError("File not found", 404);
        }

        const file = rows[0];
        const newName = name + path.extname(file.original_name);

        const [duplicateRows] = await db.execute(
            `SELECT id FROM files 
             WHERE owner = ? AND (parent = ? OR (? IS NULL AND parent IS NULL)) 
             AND original_name = ? AND id != ? AND is_deleted = false LIMIT 1`,
            [user.id, file.parent, file.parent, newName, targetId],
        );

        if (duplicateRows.length > 0) {
            throw new CustomAPIError("There is already a file with the same name in this directory", 400);
        }

        await db.execute(`UPDATE files SET original_name = ? WHERE id = ? AND owner = ?`, [newName, targetId, user.id]);
        message = "Your file has been successfully renamed";
    } else if (type === "folder") {
        const [rows] = await db.execute(
            `SELECT parent FROM folders WHERE id = ? AND owner = ? AND is_deleted = false`,
            [targetId, user.id],
        );

        if (rows.length === 0) {
            throw new CustomAPIError("Folder not found", 404);
        }

        const currentFolder = rows[0];

        const [duplicateRows] = await db.execute(
            `SELECT id FROM folders 
             WHERE owner = ? AND (parent = ? OR (? IS NULL AND parent IS NULL)) 
             AND name = ? AND id != ? AND is_deleted = false LIMIT 1`,
            [user.id, currentFolder.parent, currentFolder.parent, name, targetId],
        );

        if (duplicateRows.length > 0) {
            throw new CustomAPIError("There is already a folder with the same name in this directory", 400);
        }

        await db.execute(`UPDATE folders SET name = ? WHERE id = ? AND owner = ?`, [name, targetId, user.id]);
        message = "Your folder has been successfully renamed";
    } else {
        throw new CustomAPIError("Invalid type provided", 400);
    }

    res.status(200).json({ message });
};

const star = async (req, res) => {
    let { files, folders } = req.body;
    const user = req.user;

    if ((!files || files.length === 0) && (!folders || folders.length === 0)) {
        throw new CustomAPIError("No files or folders found", 400);
    }

    const conn = await db.getConnection();
    await conn.beginTransaction();

    try {
        if (files && files.length > 0) {
            const fileIds = files.map((f) => f.id);
            const [rows] = await conn.execute(
                `UPDATE files SET is_starred = true WHERE id IN (${fileIds.map(() => "?").join(", ")}) AND owner = ?`,
                [...fileIds, user.id],
            );

            if (rows.affectedRows !== fileIds.length) {
                throw new CustomAPIError("One or more files not found", 404);
            }
        }

        if (folders && folders.length > 0) {
            const folderIds = folders.map((f) => f.id);
            const [rows] = await conn.execute(
                `UPDATE folders SET is_starred = true WHERE id IN (${folderIds.map(() => "?").join(", ")}) AND owner = ?`,
                [...folderIds, user.id],
            );

            if (rows.affectedRows !== folderIds.length) {
                throw new CustomAPIError("One or more folders not found", 404);
            }
        }

        await conn.commit();
        res.status(200).json({ message: "Starred successfully" });
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
};

const unstar = async (req, res) => {
    let { files, folders } = req.body;
    const user = req.user;

    if ((!files || files.length === 0) && (!folders || folders.length === 0)) {
        throw new CustomAPIError("No files or folders found", 400);
    }

    const conn = await db.getConnection();
    await conn.beginTransaction();

    try {
        if (files && files.length > 0) {
            const fileIds = files.map((f) => f.id);
            const [rows] = await conn.execute(
                `UPDATE files SET is_starred = false WHERE id IN (${fileIds.map(() => "?").join(", ")}) AND owner = ?`,
                [...fileIds, user.id],
            );

            if (rows.affectedRows !== fileIds.length) {
                throw new CustomAPIError("One or more files not found", 404);
            }
        }

        if (folders && folders.length > 0) {
            const folderIds = folders.map((f) => f.id);
            const [rows] = await conn.execute(
                `UPDATE folders SET is_starred = false WHERE id IN (${folderIds.map(() => "?").join(", ")}) AND owner = ?`,
                [...folderIds, user.id],
            );

            if (rows.affectedRows !== folderIds.length) {
                throw new CustomAPIError("One or more folders not found", 404);
            }
        }

        await conn.commit();
        res.status(200).json({ message: "Removed from starred" });
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
};

const getFolders = async (req, res) => {
    let parent = req.params.id;
    let folderId = req.query.folderId;

    parent = parent && !isNaN(parseInt(parent)) ? parseInt(parent) : null;
    folderId = folderId && !isNaN(parseInt(folderId)) ? parseInt(folderId) : 0;
    const user = req.user;

    let [folders] = await db.execute(
        `SELECT id, parent, name FROM folders 
         WHERE owner = ? AND (parent = ? OR (? IS NULL AND parent IS NULL)) AND is_deleted = false AND id != ?`,
        [user.id, parent, parent, folderId ?? -1],
    );

    folders = folders.length === 0 ? null : folders;

    let parentFolder = null;
    const lookupParent = folders !== null ? folders[0]?.parent : parent;

    if (lookupParent) {
        const [rows] = await db.execute(
            `SELECT id, parent, name FROM folders WHERE id = ? AND owner = ? AND is_deleted = false`,
            [lookupParent, user.id],
        );
        parentFolder = rows.length > 0 ? rows[0] : null;
    }

    res.status(200).json({ folders, parentFolder });
};

const move = async (req, res) => {
    let { data, parent } = req.body;
    parent = parent && Number.isInteger(Number(parent)) ? Number(parent) : null;

    const user = req.user;
    const files = data?.files;
    const folders = data?.folders;

    if (!files?.length && !folders?.length) {
        throw new CustomAPIError("No files or folders found");
    }

    const conn = await db.getConnection();
    await conn.beginTransaction();

    try {
        if (files?.length > 0) {
            for (const f of files) {
                const [[file]] = await conn.execute(`SELECT * FROM files WHERE id = ? AND owner = ?`, [f.id, user.id]);

                if (!file) {
                    throw new CustomAPIError("File not found", 404);
                }

                if (file.parent === parent) {
                    throw new CustomAPIError("This file is already in this directory", 400);
                }

                const ext = path.extname(file.original_name);
                const base = path.basename(file.original_name, ext);

                const [[{ count }]] = await conn.execute(
                    `SELECT COUNT(*) as count FROM files 
                    WHERE owner = ? AND (parent = ? OR (? IS NULL AND parent IS NULL)) AND is_deleted = FALSE
                    AND original_name REGEXP ?`,
                    [user.id, parent, parent, `^${base}( \\([0-9]+\\))?${ext}$`],
                );

                const newName = count === 0 ? file.original_name : `${base} (${count})${ext}`;

                await conn.execute(`UPDATE files SET original_name = ?, parent = ? WHERE id = ?`, [
                    newName,
                    parent,
                    file.id,
                ]);
            }
        }

        if (folders?.length > 0) {
            for (const f of folders) {
                const [[folder]] = await conn.execute(`SELECT * FROM folders WHERE id = ? AND owner = ?`, [
                    f.id,
                    user.id,
                ]);

                if (!folder) {
                    throw new CustomAPIError("Folder not found", 404);
                }

                if (folder.parent === parent) {
                    throw new CustomAPIError("This folder is already in this directory", 400);
                }

                const [[{ count }]] = await conn.execute(
                    `SELECT COUNT(*) as count FROM folders 
                    WHERE owner = ? AND (parent = ? OR (? IS NULL AND parent IS NULL)) AND is_deleted = FALSE
                    AND name REGEXP ?`,
                    [user.id, parent, parent, `^${folder.name}( \\([0-9]+\\))?$`],
                );

                const newName = count === 0 ? folder.name : `${folder.name} (${count})`;

                await conn.execute(`UPDATE folders SET name = ?, parent = ? WHERE id = ?`, [
                    newName,
                    parent,
                    folder.id,
                ]);
            }
        }

        await conn.commit();
        res.status(200).json({ message: "Moved successfully" });
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
};

const shareFile = async (req, res) => {
    const fileId = parseInt(req.params.id);
    if (isNaN(fileId)) throw new CustomAPIError("File not found", 404);
    const user = req.user;

    const uniqueId = crypto.randomBytes(16).toString("hex");

    const [rows] = await db.execute(`UPDATE files SET public_key = ? WHERE id = ? AND owner = ?`, [
        uniqueId,
        fileId,
        user.id,
    ]);

    if (rows.affectedRows === 0) {
        throw new CustomAPIError("File not found", 404);
    }

    res.status(200).json({ link: `${process.env.FRONTEND_URL}/file/d/${uniqueId}`, message: "Your file is public" });
};

const makeFilePrivate = async (req, res) => {
    const fileId = parseInt(req.params.id);
    if (isNaN(fileId)) throw new CustomAPIError("File not found", 404);
    const user = req.user;

    const [rows] = await db.execute(`UPDATE files SET public_key = NULL WHERE id = ? AND owner = ?`, [fileId, user.id]);

    if (rows.affectedRows === 0) {
        throw new CustomAPIError("File not found", 404);
    }

    res.status(200).json({ message: "Your file has been set to private" });
};

const moveToTrash = async (req, res) => {
    let { files, folders } = req.body;
    const user = req.user;

    if (!files && !folders) {
        throw new CustomAPIError("No files or folders found");
    }

    const conn = await db.getConnection();
    await conn.beginTransaction();

    try {
        if (files && files.length > 0) {
            for (const f of files) {
                const [rows] = await conn.execute(`SELECT id FROM files WHERE id = ? AND owner = ?`, [f.id, user.id]);

                if (rows.length === 0) {
                    throw new CustomAPIError("File not found", 404);
                }

                await conn.execute(
                    `UPDATE files SET is_deleted = true, deleted_at = NOW(), is_starred = false, public_key = NULL WHERE id = ?`,
                    [f.id],
                );
            }
        }

        if (folders && folders.length > 0) {
            for (const f of folders) {
                const [rows] = await conn.execute(`SELECT id FROM folders WHERE id = ? AND owner = ?`, [f.id, user.id]);

                if (rows.length === 0) {
                    throw new CustomAPIError("Folder not found", 404);
                }

                await conn.execute(
                    `UPDATE folders SET is_deleted = true, deleted_at = NOW(), is_starred = false WHERE id = ?`,
                    [f.id],
                );
            }
        }

        await conn.commit();
        res.status(200).json({ message: "Moved to trash" });
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
};

const restore = async (req, res) => {
    let { files, folders } = req.body;
    const user = req.user;

    if (!files && !folders) {
        throw new CustomAPIError("No files or folders found");
    }

    async function resolveParent(conn, parent) {
        if (!parent) return null;
        const [ancestors] = await conn.execute(
            `WITH RECURSIVE ancestors AS (
                SELECT id, parent, is_deleted
                FROM folders
                WHERE id = ?

                UNION ALL
                
                SELECT f.id, f.parent, f.is_deleted
                FROM folders f
                INNER JOIN ancestors a ON f.id = a.parent
            )
            SELECT id, is_deleted FROM ancestors`,
            [parent],
        );

        const hasDeletedAncestor = ancestors.some((a) => a.is_deleted);
        return hasDeletedAncestor ? null : parent;
    }

    async function resolveFileName(conn, originalName, parent, owner) {
        const baseName = path.basename(originalName, path.extname(originalName));
        const ext = path.extname(originalName);

        const [existing] = await conn.execute(
            `SELECT original_name FROM files
            WHERE owner = ? AND (parent = ? OR (? IS NULL AND parent IS NULL)) AND is_deleted = false
            AND original_name REGEXP ?`,
            [owner, parent, parent, `^${baseName}( \\([0-9]+\\))?${ext}$`],
        );

        if (existing.length === 0) return originalName;

        const usedNames = new Set(existing.map((r) => r.original_name));
        let i = 1;
        while (usedNames.has(`${baseName} (${i})${ext}`)) i++;
        return `${baseName} (${i})${ext}`;
    }

    async function resolveFolderName(conn, originalName, parent, owner) {
        const [existing] = await conn.execute(
            `SELECT name FROM folders
            WHERE owner = ? AND (parent = ? OR (? IS NULL AND parent IS NULL)) AND is_deleted = false
            AND name REGEXP ?`,
            [owner, parent, parent, `^${originalName}( \\([0-9]+\\))?$`],
        );

        if (existing.length === 0) return originalName;

        const usedNames = new Set(existing.map((r) => r.name));
        let i = 1;
        while (usedNames.has(`${originalName} (${i})`)) i++;
        return `${originalName} (${i})`;
    }

    const conn = await db.getConnection();
    await conn.beginTransaction();

    try {
        if (files && files.length > 0) {
            for (const f of files) {
                const [rows] = await conn.execute(
                    `SELECT id, parent, original_name FROM files WHERE id = ? AND owner = ?`,
                    [f.id, user.id],
                );

                if (rows.length === 0) {
                    throw new CustomAPIError("File not found", 404);
                }

                const file = rows[0];

                const resolvedParent = await resolveParent(conn, file.parent);
                const resolvedName = await resolveFileName(conn, file.original_name, resolvedParent, user.id);

                await conn.execute(
                    `UPDATE files SET is_deleted = false, deleted_at = NULL, parent = ?, original_name = ? WHERE id = ?`,
                    [resolvedParent, resolvedName, f.id],
                );
            }
        }

        if (folders && folders.length > 0) {
            for (const f of folders) {
                const [rows] = await conn.execute(`SELECT id, parent, name FROM folders WHERE id = ? AND owner = ?`, [
                    f.id,
                    user.id,
                ]);

                if (rows.length === 0) {
                    throw new CustomAPIError("Folder not found", 404);
                }

                const folder = rows[0];

                const resolvedParent = await resolveParent(conn, folder.parent);
                const resolvedName = await resolveFolderName(conn, folder.name, resolvedParent, user.id);

                await conn.execute(
                    `UPDATE folders SET is_deleted = false, deleted_at = NULL, parent = ?, name = ? WHERE id = ?`,
                    [resolvedParent, resolvedName, f.id],
                );
            }
        }

        await conn.commit();
        res.status(200).json({ message: "Restored successfully" });
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
};

const deletePermanently = async (req, res) => {
    let { files, folders } = req.body;
    const user = req.user;

    if (!files && !folders) {
        throw new CustomAPIError("No files or folders found");
    }

    const userFilesPath = path.join(__dirname, `../private/${user.id}/`);

    const conn = await db.getConnection();
    await conn.beginTransaction();

    try {
        if (files && files.length > 0) {
            for (const f of files) {
                const [rows] = await conn.execute(
                    `SELECT id, name, size FROM files WHERE id = ? AND owner = ? AND is_deleted = true`,
                    [f.id, user.id],
                );

                if (rows.length === 0) {
                    throw new CustomAPIError("File not found", 404);
                }

                const file = rows[0];

                try {
                    await fs.rm(path.join(userFilesPath, file.name), { recursive: true, force: true });
                } catch (err) {
                    throw new CustomAPIError("Something went wrong", 500);
                }

                await conn.execute(`DELETE FROM files WHERE id = ?`, [file.id]);
                await conn.execute(`UPDATE users SET current_storage = current_storage - ? WHERE id = ?`, [
                    file.size,
                    user.id,
                ]);
            }
        }

        if (folders && folders.length > 0) {
            for (const f of folders) {
                const [rows] = await conn.execute(
                    `SELECT id FROM folders WHERE id = ? AND owner = ? AND is_deleted = true`,
                    [f.id, user.id],
                );

                if (rows.length === 0) {
                    throw new CustomAPIError("Folder not found", 404);
                }

                const [allFolderIdRows] = await conn.execute(
                    `WITH RECURSIVE descendants AS (
                        SELECT id FROM folders WHERE id = ?
                        UNION ALL
                        SELECT f.id FROM folders f
                        INNER JOIN descendants d ON f.parent = d.id
                    )
                    SELECT id FROM descendants`,
                    [f.id],
                );

                const folderIdList = allFolderIdRows.map((r) => r.id);
                const placeholders = folderIdList.map(() => "?").join(", ");

                const [allFileRows] = await conn.execute(
                    `SELECT id, name, size FROM files
                     WHERE owner = ? AND parent IN (${placeholders})`,
                    [user.id, ...folderIdList],
                );

                await Promise.all(
                    allFileRows.map(async (f) => {
                        try {
                            await fs.rm(path.join(userFilesPath, f.name), { recursive: true, force: true });
                        } catch (err) {
                            throw new CustomAPIError("Something went wrong", 500);
                        }
                    }),
                );

                const freedStorage = allFileRows.reduce((sum, f) => sum + f.size, 0);

                if (allFileRows.length > 0) {
                    const filePlaceholders = allFileRows.map(() => "?").join(", ");
                    await conn.execute(
                        `DELETE FROM files WHERE id IN (${filePlaceholders})`,
                        allFileRows.map((f) => f.id),
                    );
                }

                await conn.execute(`DELETE FROM folders WHERE id IN (${placeholders})`, folderIdList);

                if (freedStorage > 0) {
                    await conn.execute(`UPDATE users SET current_storage = current_storage - ? WHERE id = ?`, [
                        freedStorage,
                        user.id,
                    ]);
                }
            }
        }

        const [[{ current_storage }]] = await conn.execute(`SELECT current_storage FROM users WHERE id = ?`, [user.id]);

        await conn.commit();
        res.status(200).json({
            currentStorage: current_storage,
            message: "Deleted successfully",
        });
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
};

const getFilePreviewPublic = async (req, res) => {
    const publicKey = req.params.key;

    const [rows] = await db.execute(
        `SELECT id, name, original_name, size, mime_type, owner FROM files WHERE public_key = ?`,
        [publicKey],
    );

    if (rows.length === 0) {
        throw new CustomAPIError("File not found", 404);
    }

    const file = rows[0];

    const MAX_SIZE = 1024 * 1024 * 20;
    if (file.size > MAX_SIZE) throw new CustomAPIError("This file is too big to preview", 413);

    const uploadPath = path.join(__dirname, `../private/${file.owner}/`);
    const encryptedFilePath = path.join(uploadPath, file.name);
    let buffer;
    try {
        buffer = await decryptFile(encryptedFilePath);
    } catch (err) {
        throw new CustomAPIError("Something went wrong", 500);
    }

    await previewFile(res, buffer, file.mime_type, file.original_name, file.size);
};

const getFileDetailsPublic = async (req, res) => {
    const publicKey = req.params.key;

    const [rows] = await db.execute(
        `SELECT f.original_name, f.size, f.type, u.first_name, u.last_name, u.profile_image
         FROM files f
         JOIN users u ON u.id = f.owner
         WHERE f.public_key = ?`,
        [publicKey],
    );

    if (rows.length === 0) {
        throw new CustomAPIError("File not found", 404);
    }

    const row = rows[0];

    res.status(200).json({
        owner: {
            firstName: row.first_name,
            lastName: row.last_name,
            profileImage: row.profile_image,
        },
        originalName: row.original_name,
        size: bytesToSize(row.size),
        type: row.type,
    });
};

const downloadFilePublic = async (req, res) => {
    const publicKey = req.params.key;

    const [rows] = await db.execute(`SELECT name, original_name, mime_type, owner FROM files WHERE public_key = ?`, [
        publicKey,
    ]);

    if (rows.length === 0) {
        throw new CustomAPIError("File not found", 404);
    }

    const file = rows[0];

    const uploadPath = path.join(__dirname, `../private/${file.owner}/`);
    const encryptedFilePath = path.join(uploadPath, file.name);
    let buffer;

    try {
        buffer = await decryptFile(encryptedFilePath);
    } catch (err) {
        throw new CustomAPIError("Something went wrong", 500);
    }

    res.setHeader("Content-Disposition", `attachment; filename="${file.original_name}"`);
    res.type(file.mime_type);
    res.status(200).send(buffer);
};

module.exports = {
    uploadFile,
    getFilesAndFolders,
    searchFilesAndFolders,
    getStarredFilesAndFolders,
    getTrashedFilesAndFolders,
    getFileDetails,
    downloadFile,
    createFolder,
    rename,
    star,
    unstar,
    getFolders,
    move,
    shareFile,
    makeFilePrivate,
    moveToTrash,
    restore,
    deletePermanently,
    getFilePreviewPublic,
    getFileDetailsPublic,
    downloadFilePublic,
};
