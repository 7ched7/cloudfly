const db = require("../config/db.js");
const CustomAPIError = require("../errors/custom.error.js");
const path = require("path");
const crypto = require("crypto");
const moment = require("moment");
const mime = require("mime-types");
const { v4: uuid } = require("uuid");
const { bytesToSize } = require("../utils/helpers.js");
const s3Client = require("../config/s3Client.js");
const { GetObjectCommand, PutObjectCommand, DeleteObjectsCommand, HeadObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const presignedUrls = async (req, res) => {
    let { files, parent } = req.body;
    parent = parent && !isNaN(parseInt(parent)) ? parseInt(parent) : null;
    const user = req.user;

    const conn = await db.getConnection();
    await conn.beginTransaction();

    try {
        const [userRows] = await conn.execute(
            `SELECT current_storage, reserved_storage, max_storage FROM users 
            WHERE id = ? 
            FOR UPDATE`,
            [user.id],
        );

        if (userRows.length === 0) {
            throw new CustomAPIError("User not found", 404);
        }

        const userRow = userRows[0];

        const remaining = userRow.max_storage - (userRow.current_storage + userRow.reserved_storage);

        const sorted = [...files].sort((a, b) => a.size - b.size);
        const accepted = [];
        const rejected = [];
        let currSize = 0;

        for (const f of sorted) {
            if (currSize + f.size <= remaining) {
                accepted.push(f);
                currSize += f.size;
            } else {
                rejected.push({ ...f, reason: "The size of the file exceeds your storage limit" });
            }
        }

        const results = [];

        for (const file of accepted) {
            const [[existingRow]] = await conn.execute(
                `SELECT id, uuid, current_version FROM files 
                WHERE owner = ? AND (parent = ? OR (? IS NULL AND parent IS NULL)) AND original_name = ? AND is_deleted = FALSE
                ORDER BY updated_at DESC
                LIMIT 1`,
                [user.id, parent, parent, file.name],
            );

            let fileId, version, fileUuid, storageKey;
            const mimeType = mime.lookup(file.name) || "application/octet-stream";
            const type = mime.extension(mimeType) || "unknown";

            if (!existingRow) {
                fileUuid = uuid();
                version = 1;
                storageKey = `uploads/${user.id}/${fileUuid}/v${version}.${type}`;

                const [fileResult] = await conn.execute(
                    `INSERT INTO files 
                    (owner, uuid, original_name, current_version, current_size, current_mime_type, current_type)
                    VALUES (?, ?, ?, NULL, ?, ?, ?)`,
                    [user.id, fileUuid, file.name, file.size, mimeType, type],
                );

                fileId = fileResult.insertId;

                await conn.execute(
                    `INSERT INTO file_versions (file, storage_key, version, size, mime_type, type, status)
                    VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
                    [fileId, storageKey, version, file.size, mimeType, type],
                );

                await conn.execute(`UPDATE files SET current_version = ? WHERE id = ? AND owner = ?`, [version, fileId, user.id]);
            } else {
                fileUuid = existingRow.uuid;

                const [[lastVersionRow]] = await conn.execute(
                    `SELECT MAX(version) as max_v FROM file_versions WHERE file = ?`,
                    [existingRow.id],
                );

                if (!lastVersionRow) {
                    throw new CustomAPIError(`File version not found for ID: ${existingRow.id}`, 404);
                }

                version = lastVersionRow.max_v + 1;
                fileId = existingRow.id;

                storageKey = `uploads/${user.id}/${fileUuid}/v${version}.${type}`;

                await conn.execute(
                    `INSERT INTO file_versions (file, storage_key, version, size, mime_type, type, status)
                    VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
                    [fileId, storageKey, version, file.size, mimeType, type],
                );

                await conn.execute(
                    `UPDATE files 
                    SET current_version = ?, current_size = ?, current_mime_type = ?, current_type = ?
                    WHERE id = ? AND owner = ?`,
                    [version, file.size, mimeType, type, fileId, user.id],
                );
            }

            results.push({
                fileId,
                name: file.name,
                size: file.size,
                type: mimeType,
                version,
                storageKey,
            });
        }

        await conn.execute("UPDATE users SET reserved_storage = reserved_storage + ? WHERE id = ?", [
            currSize,
            user.id,
        ]);
        await conn.commit();

        const presigned = await Promise.all(
            results.map(async (r) => {
                const command = new PutObjectCommand({
                    Bucket: process.env.MINIO_FILES_BUCKET,
                    ContentLength: r.size,
                    ContentType: r.type,
                    Key: r.storageKey,
                });

                const url = await getSignedUrl(s3Client, command, { expiresIn: 30 });

                return {
                    fileId: r.fileId,
                    name: r.name,
                    version: r.version,
                    url,
                };
            }),
        );

        return res.json({
            accepted: presigned,
            rejected,
        });
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
};

const completeUpload = async (req, res) => {
    let { data, parent } = req.body;
    parent = parent && !isNaN(parseInt(parent)) ? parseInt(parent) : null;
    const user = req.user;
    let totalActualSize = 0;

    const results = [];

    for (const file of data) {
        const [[versionRow]] = await db.execute(
            `SELECT fv.storage_key 
            FROM file_versions fv
            JOIN files f ON f.id = fv.file
            WHERE f.owner = ? AND fv.file = ? AND fv.version = ? AND fv.status = 'pending'`,
            [user.id, file.fileId, file.version],
        );

        if (!versionRow) {
            throw new CustomAPIError(`File or version not found for ID: ${file.fileId}`, 404);
        }

        let head;
        try {
            head = await s3Client.send(
                new HeadObjectCommand({
                    Bucket: process.env.MINIO_FILES_BUCKET,
                    Key: versionRow.storage_key,
                }),
            );
        } catch (err) {
            throw new CustomAPIError(`File not found in storage for ID: ${file.fileId}`, 400);
        }

        totalActualSize += head.ContentLength;
        results.push({ file, contentLength: head.ContentLength });
    }
    
    const conn = await db.getConnection();
    await conn.beginTransaction();

    try {
        for (const { file, contentLength } of results) {
            if (parent) {
                const [[parentRow]] = await conn.execute(
                    `SELECT id FROM folders 
                    WHERE id = ? AND owner = ?`,
                    [parent, user.id]
                );
                
                if (parentRow) {
                    await conn.execute("UPDATE files SET parent = ? WHERE id = ? AND owner = ?", [parentRow.id, file.fileId, user.id]);
                } else {
                    await conn.execute(
                        `UPDATE files 
                        SET is_deleted = true, deleted_at = NOW(), is_starred = false, public_key = NULL
                        WHERE id = ? AND owner = ?`,
                        [file.fileId, user.id]
                    );
                }
            }

            await conn.execute(
                "UPDATE file_versions SET status = 'uploaded', size = ? WHERE file = ? AND version = ?",
                [contentLength, file.fileId, file.version],
            );
        }

        await conn.execute(
            "UPDATE users SET current_storage = current_storage + ?, reserved_storage = reserved_storage - ? WHERE id = ?",
            [totalActualSize, totalActualSize, user.id],
        );

        const [[{ current_storage }]] = await conn.execute("SELECT current_storage FROM users WHERE id = ?", [user.id]);

        await conn.commit();

        return res.status(200).json({
            currentStorage: current_storage,
            message: "Uploaded successfully",
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
        `SELECT id, parent, original_name, current_mime_type, current_type, is_starred, is_deleted, public_key 
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
                  mimeType: f.current_mime_type,
                  type: f.current_type,
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
        `SELECT id, parent, original_name, current_mime_type, current_type, is_starred, is_deleted, public_key 
        FROM files 
        WHERE owner = ? AND is_deleted = false AND original_name LIKE ?`,
        [user.id, `%${k}%`],
    );

    let [folders] = await db.execute(
        `SELECT id, parent, name, is_starred, is_deleted 
        FROM folders 
        WHERE owner = ? AND is_deleted = false AND name LIKE ?`,
        [user.id, `%${k}%`],
    );

    files =
        files.length === 0
            ? null
            : files.map((f) => ({
                  id: f.id,
                  parent: f.parent,
                  originalName: f.original_name,
                  mimeType: f.current_mime_type,
                  type: f.current_type,
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
        `SELECT id, parent, original_name, current_mime_type, current_type, is_starred, is_deleted, public_key 
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
                  mimeType: f.current_mime_type,
                  type: f.current_type,
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
        `SELECT id, parent, original_name, current_mime_type, current_type, is_starred, is_deleted, public_key 
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
                  mimeType: f.current_mime_type,
                  type: f.current_type,
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

    const [[fileRow]] = await db.execute(
        `SELECT original_name, current_size, current_mime_type, current_type, is_starred, public_key, created_at, updated_at 
        FROM files WHERE id = ? AND owner = ?`,
        [fileId, user.id],
    );

    if (!fileRow) {
        throw new CustomAPIError("File not found", 404);
    }

    res.status(200).json({
        originalName: fileRow.original_name,
        size: bytesToSize(fileRow.current_size),
        mimeType: fileRow.current_mime_type,
        type: fileRow.current_type,
        isStarred: Boolean(fileRow.is_starred),
        publicKey: fileRow.public_key,
        createdAt: moment(fileRow.created_at).format("LLLL"),
        updatedAt: moment(fileRow.updated_at).format("LLLL"),
    });
};

const downloadFile = async (req, res) => {
    const fileId = parseInt(req.params.id);
    if (isNaN(fileId)) throw new CustomAPIError("File not found", 404);
    const user = req.user;

    const [[fileVersion]] = await db.execute(
        `SELECT f.original_name, fv.storage_key 
        FROM file_versions fv
        JOIN files f ON f.id = fv.file
        WHERE f.owner = ? AND fv.file = ? AND fv.version = f.current_version AND fv.status = 'uploaded'`,
        [user.id, fileId],
    );

    if (!fileVersion) {
        throw new CustomAPIError("File not found", 404);
    }

    const command = new GetObjectCommand({
        Bucket: process.env.MINIO_FILES_BUCKET,
        Key: fileVersion.storage_key,
        ResponseContentDisposition: `attachment; filename="${fileVersion.original_name}"`,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn: 30 });
    res.status(200).send({ url });
};

const createFolder = async (req, res) => {
    let { name, parent } = req.body;
    parent = parent && !isNaN(parseInt(parent)) ? parseInt(parent) : null;
    const user = req.user;

    if (!name) {
        throw new CustomAPIError("Please provide a name", 400);
    }

    const conn = await db.getConnection();
    await conn.beginTransaction();

    try {
        const [[existingRow]] = await conn.execute(
            `SELECT id FROM folders 
            WHERE owner = ? AND (parent = ? OR (? IS NULL AND parent IS NULL)) AND name = ? AND is_deleted = false 
            LIMIT 1`,
            [user.id, parent, parent, name],
        );

        if (existingRow) {
            throw new CustomAPIError("There is already a folder with the same name in this directory", 400);
        }

        let path = "/";
        if (parent) {
            const [[parentRow]] = await conn.execute(
                `SELECT path FROM folders
                WHERE id = ? AND owner = ? AND is_deleted = false`,
                [parent, user.id],
            );

            if (!parentRow) {
                throw new CustomAPIError("Parent folder not found", 404);
            }

            path = `${parentRow.path}${parent}/`;
        }

        const [result] = await conn.execute(
            `INSERT INTO folders (owner, parent, name, path) 
            VALUES (?, ?, ?, ?)`,
            [user.id, parent, name, path],
        );

        await conn.commit();
        res.status(201).json({
            folder: {
                id: result.insertId,
                parent: parent,
                name,
                isStarred: false,
            },
            message: "Folder created successfully",
        });
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
};

const rename = async (req, res) => {
    let { id, name, type } = req.body;
    const targetId = parseInt(id);
    const user = req.user;

    if (!name || isNaN(targetId)) {
        throw new CustomAPIError("Please provide valid id and name", 400);
    }

    let message;

    const conn = await db.getConnection();
    await conn.beginTransaction();

    try {
        if (type === "file") {
            const [[fileRow]] = await conn.execute(
                `SELECT parent, original_name FROM files 
                WHERE id = ? AND owner = ? AND is_deleted = false`,
                [targetId, user.id],
            );

            if (!fileRow) {
                throw new CustomAPIError("File not found", 404);
            }

            const newName = name + path.extname(fileRow.original_name);

            const [[existingRow]] = await conn.execute(
                `SELECT id FROM files 
                WHERE owner = ? AND (parent = ? OR (? IS NULL AND parent IS NULL)) 
                AND original_name = ? AND id != ? AND is_deleted = false
                LIMIT 1`,
                [user.id, fileRow.parent, fileRow.parent, newName, targetId],
            );

            if (existingRow) {
                throw new CustomAPIError("There is already a file with the same name in this directory", 400);
            }

            await conn.execute(`UPDATE files SET original_name = ? WHERE id = ? AND owner = ?`, [
                newName,
                targetId,
                user.id,
            ]);
            message = "Your file has been successfully renamed";
        } else if (type === "folder") {
            const [[folderRow]] = await conn.execute(
                `SELECT parent FROM folders 
                WHERE id = ? AND owner = ? AND is_deleted = false`,
                [targetId, user.id],
            );

            if (!folderRow) {
                throw new CustomAPIError("Folder not found", 404);
            }

            const [[existingRow]] = await conn.execute(
                `SELECT id FROM folders 
                WHERE owner = ? AND (parent = ? OR (? IS NULL AND parent IS NULL)) 
                AND name = ? AND id != ? AND is_deleted = false
                LIMIT 1`,
                [user.id, folderRow.parent, folderRow.parent, name, targetId],
            );

            if (existingRow) {
                throw new CustomAPIError("There is already a folder with the same name in this directory", 400);
            }

            await conn.execute(`UPDATE folders SET name = ? WHERE id = ? AND owner = ?`, [name, targetId, user.id]);
            message = "Your folder has been successfully renamed";
        } else {
            throw new CustomAPIError("Invalid type provided", 400);
        }

        await conn.commit();
        res.status(200).json({ message });
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
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
                `UPDATE files SET is_starred = true 
                WHERE id IN (${fileIds.map(() => "?").join(", ")}) AND owner = ?`,
                [...fileIds, user.id],
            );

            if (rows.affectedRows !== fileIds.length) {
                throw new CustomAPIError("One or more files not found", 404);
            }
        }

        if (folders && folders.length > 0) {
            const folderIds = folders.map((f) => f.id);

            const [rows] = await conn.execute(
                `UPDATE folders SET is_starred = true 
                WHERE id IN (${folderIds.map(() => "?").join(", ")}) AND owner = ?`,
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
                `UPDATE files SET is_starred = false 
                WHERE id IN (${fileIds.map(() => "?").join(", ")}) AND owner = ?`,
                [...fileIds, user.id],
            );
            if (rows.affectedRows !== fileIds.length) {
                throw new CustomAPIError("One or more files not found", 404);
            }
        }

        if (folders && folders.length > 0) {
            const folderIds = folders.map((f) => f.id);

            const [rows] = await conn.execute(
                `UPDATE folders SET is_starred = false 
                WHERE id IN (${folderIds.map(() => "?").join(", ")}) AND owner = ?`,
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
        const [[p]] = await db.execute(
            `SELECT id, parent, name FROM folders WHERE id = ? AND owner = ? AND is_deleted = false`,
            [lookupParent, user.id],
        );
        parentFolder = p || null;
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
        throw new CustomAPIError("No files or folders found", 404);
    }

    const conn = await db.getConnection();
    await conn.beginTransaction();

    try {
        if (files?.length > 0) {
            for (const f of files) {
                const [[fileRow]] = await conn.execute(
                    `SELECT * FROM files 
                    WHERE id = ? AND owner = ?`,
                    [f.id, user.id],
                );

                if (!fileRow) {
                    throw new CustomAPIError("File not found", 404);
                }

                if (fileRow.parent === parent) {
                    throw new CustomAPIError("This file is already in this directory", 400);
                }

                const resolvedName = await resolveFileName(conn, fileRow.original_name, parent, user.id);

                await conn.execute(`UPDATE files SET original_name = ?, parent = ? WHERE id = ? AND owner = ?`, [
                    resolvedName,
                    parent,
                    fileRow.id,
                    user.id,
                ]);
            }
        }

        if (folders?.length > 0) {
            let targetPath = "/";

            if (parent) {
                const [[parentRow]] = await conn.execute(
                    `SELECT id, path FROM folders 
                    WHERE id = ? AND owner = ?`,
                    [parent, user.id],
                );

                if (!parentRow) {
                    throw new CustomAPIError("Folder not found", 404);
                }

                parent = parentRow.id;
                targetPath = `${parentRow.path}${parentRow.id}/`;
            }

            for (const f of folders) {
                const [[folderRow]] = await conn.execute(
                    `SELECT * FROM folders 
                    WHERE id = ? AND owner = ?`,
                    [f.id, user.id],
                );

                if (!folderRow) {
                    throw new CustomAPIError("Folder not found", 404);
                }

                // 1. Check if the folder is moved to the same directory
                if (folderRow.parent === parent) {
                    throw new CustomAPIError("This folder is already in this directory", 400);
                }

                const oldPrefix = `${folderRow.path}${folderRow.id}/`;
                const newPrefix = `${targetPath}${folderRow.id}/`;

                // 2. Check if the folder is moved to itself or to one of its subfolders
                if (folderRow.id === parent || newPrefix.startsWith(oldPrefix)) {
                    throw new CustomAPIError("Folder cannot be moved into itself", 400);
                }

                // 3. If there is a folder with the same name, add a suffix
                const resolvedName = await resolveFolderName(conn, folderRow.name, parent, user.id);

                // 4. Update the folder being moved
                await conn.execute(`UPDATE folders SET name = ?, parent = ?, path = ? WHERE id = ? AND owner = ?`, [
                    resolvedName,
                    parent,
                    targetPath,
                    folderRow.id,
                    user.id,
                ]);

                // 5. Update paths of the subfolders
                await conn.execute(
                    `UPDATE folders 
                    SET path = REPLACE(path, ?, ?) 
                    WHERE path LIKE ? AND owner = ?`,
                    [oldPrefix, newPrefix, `${oldPrefix}%`, user.id],
                );
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
            const fileIds = files.map((f) => f.id);

            const [existingFileRows] = await conn.execute(
                `SELECT id FROM files
                WHERE id IN (${fileIds.map(() => "?").join(", ")}) AND owner = ? AND is_deleted = false`,
                [...fileIds, user.id],
            );

            if (existingFileRows.length !== fileIds.length) {
                throw new CustomAPIError("One or more files not found", 404);
            }

            await conn.execute(
                `UPDATE files 
                SET is_deleted = true, deleted_at = NOW(), is_starred = false, public_key = NULL 
                WHERE id IN (${fileIds.map(() => "?").join(", ")}) AND owner = ?`,
                [...fileIds, user.id],
            );
        }

        if (folders && folders.length > 0) {
            const folderIds = folders.map((f) => f.id);

            const [existingFolderRows] = await conn.execute(
                `SELECT id FROM folders 
                WHERE id IN (${folderIds.map(() => "?").join(", ")}) AND owner = ? AND is_deleted = false`,
                [...folderIds, user.id],
            );

            if (existingFolderRows.length !== folderIds.length) {
                throw new CustomAPIError("One or more folders not found", 404);
            }

            await conn.execute(
                `UPDATE folders
                SET is_deleted = true, deleted_at = NOW(), is_starred = false
                WHERE id IN (${folderIds.map(() => "?").join(", ")}) AND owner = ?`,
                [...folderIds, user.id],
            );
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

    const conn = await db.getConnection();
    await conn.beginTransaction();

    try {
        if (files && files.length > 0) {
            for (const f of files) {
                const [[row]] = await conn.execute(
                    `SELECT fl.id, fl.parent, fl.path, fi.original_name FROM files fi 
                    LEFT JOIN folders fl ON fl.id = fi.parent 
                    WHERE fi.id = ? AND fi.owner = ?`,
                    [f.id, user.id],
                );

                if (!row) {
                    throw new CustomAPIError("File not found", 404);
                }

                const resolvedParent = await resolveParent(conn, row.id, row.id, row.path, user.id);
                const resolvedName = await resolveFileName(conn, row.original_name, resolvedParent, user.id);

                await conn.execute(
                    `UPDATE files SET is_deleted = false, deleted_at = NULL, parent = ?, original_name = ? WHERE id = ? AND owner = ?`,
                    [resolvedParent, resolvedName, f.id, user.id],
                );
            }
        }

        if (folders && folders.length > 0) {
            for (const f of folders) {
                const [[folderRow]] = await conn.execute(
                    `SELECT id, parent, name, path FROM folders 
                    WHERE id = ? AND owner = ?`,
                    [f.id, user.id],
                );

                if (!folderRow) {
                    throw new CustomAPIError("Folder not found", 404);
                }

                const resolvedParent = await resolveParent(conn, folderRow.id, folderRow.parent, folderRow.path, user.id, true);
                const resolvedName = await resolveFolderName(conn, folderRow.name, resolvedParent, user.id);

                const params = [resolvedParent, resolvedName];
                if (!resolvedParent) params.push("/");
                params.push(f.id, user.id);

                await conn.execute(
                    `UPDATE folders 
                    SET is_deleted = false, 
                        deleted_at = NULL, 
                        parent = ?, 
                        name = ?
                        ${resolvedParent ? "" : ", path = ?"} 
                    WHERE id = ? AND owner = ?`,
                    params,
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

    const s3KeysToDelete = [];
    let freedStorage = 0;

    const conn = await db.getConnection();
    await conn.beginTransaction();

    try {
        if (files && files.length > 0) {
            const fileIds = files.map((f) => f.id);
            const placeholders = fileIds.map(() => "?").join(", ");

            const [validFileRows] = await conn.execute(
                `SELECT id FROM files 
                WHERE id IN (${placeholders}) AND owner = ? AND is_deleted = true`,
                [...fileIds, user.id],
            );

            if (validFileRows.length > 0) {
                const validFileIds = validFileRows.map((f) => f.id);
                const validFilePlaceholders = validFileIds.map(() => "?").join(", ");

                const [versionRows] = await conn.execute(
                    `SELECT storage_key, size FROM file_versions 
                    WHERE file IN (${validFilePlaceholders})`,
                    validFileIds,
                );

                versionRows.forEach((v) => {
                    s3KeysToDelete.push(v.storage_key);
                    freedStorage += v.size;
                });

                await conn.execute(`DELETE FROM files WHERE id IN (${validFilePlaceholders})`, validFileIds);
            }
        }

        if (folders && folders.length > 0) {
            const folderIds = folders.map((f) => f.id);
            const folderPlaceholders = folderIds.map(() => "?").join(", ");

            const [validFolderRows] = await conn.execute(
                `SELECT id, path FROM folders 
                WHERE id IN (${folderPlaceholders}) AND owner = ? AND is_deleted = true`,
                [...folderIds, user.id],
            );

            if (validFolderRows.length > 0) {
                const conditions = validFolderRows.map(() => `(id = ? OR path LIKE ?)`).join(" OR ");
                const params = validFolderRows.flatMap((f) => [f.id, `${f.path}${f.id}/%`]);

                const [allFolderIdRows] = await conn.execute(
                    `SELECT id FROM folders 
                    WHERE owner = ? AND (${conditions})`,
                    [user.id, ...params],
                );

                if (allFolderIdRows.length > 0) {
                    const allFolderIds = allFolderIdRows.map((r) => r.id);
                    const allFolderPlaceholders = allFolderIds.map(() => "?").join(", ");

                    const [allFileRows] = await conn.execute(
                        `SELECT id FROM files 
                        WHERE owner = ? AND parent IN (${allFolderPlaceholders})`,
                        [user.id, ...allFolderIds],
                    );

                    if (allFileRows.length > 0) {
                        const childFileIds = allFileRows.map((f) => f.id);
                        const childFilePlaceholders = childFileIds.map(() => "?").join(", ");

                        const [allVersionRows] = await conn.execute(
                            `SELECT storage_key, size FROM file_versions 
                            WHERE file IN (${childFilePlaceholders})`,
                            childFileIds,
                        );

                        allVersionRows.forEach((v) => {
                            s3KeysToDelete.push(v.storage_key);
                            freedStorage += v.size;
                        });

                        await conn.execute(`DELETE FROM files WHERE id IN (${childFilePlaceholders})`, childFileIds);
                    }

                    await conn.execute(`DELETE FROM folders WHERE id IN (${allFolderPlaceholders})`, allFolderIds);
                }
            }
        }

        if (freedStorage > 0) {
            await conn.execute(`UPDATE users SET current_storage = GREATEST(0, current_storage - ?) WHERE id = ?`, [
                freedStorage,
                user.id,
            ]);
        }

        const [[{ current_storage }]] = await conn.execute(`SELECT current_storage FROM users WHERE id = ?`, [user.id]);

        await conn.commit();

        if (s3KeysToDelete.length > 0) {
            await s3Client.send(
                new DeleteObjectsCommand({
                    Bucket: process.env.MINIO_FILES_BUCKET,
                    Delete: {
                        Objects: s3KeysToDelete.map((k) => ({ Key: k })),
                    },
                }),
            );
        }

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

    const [[fileVersion]] = await db.execute(
        `SELECT f.original_name, fv.storage_key, fv.size, fv.mime_type 
        FROM file_versions fv
        JOIN files f ON f.id = fv.file
        WHERE f.public_key = ? AND fv.version = f.current_version AND fv.status = 'uploaded'`,
        [publicKey],
    );

    if (!fileVersion) {
        throw new CustomAPIError("File not found", 404);
    }

    const MAX_SIZE = 1024 * 1024 * 20;

    if (fileVersion.size > MAX_SIZE) throw new CustomAPIError("This file is too big to preview", 413);

    const command = new GetObjectCommand({
        Bucket: process.env.MINIO_FILES_BUCKET,
        Key: fileVersion.storage_key,
        ResponseContentDisposition: `inline; filename="${fileVersion.original_name}"`,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn: 30 });

    res.status(200).send({ url, mimeType: fileVersion.mime_type });
};

const getFileDetailsPublic = async (req, res) => {
    const publicKey = req.params.key;

    const [[row]] = await db.execute(
        `SELECT f.original_name, f.current_size, f.current_type, u.first_name, u.last_name, u.profile_image
        FROM files f
        JOIN users u ON u.id = f.owner
        WHERE f.public_key = ?`,
        [publicKey],
    );

    if (!row) {
        throw new CustomAPIError("File not found", 404);
    }

    let avatarUrl = null;
    if (row.profile_image) {
        avatarUrl = `${process.env.MINIO_ENDPOINT}/${process.env.MINIO_IMAGES_BUCKET}/${row.profile_image}`;
    }

    res.status(200).json({
        owner: {
            firstName: row.first_name,
            lastName: row.last_name,
            profileImage: avatarUrl,
        },
        originalName: row.original_name,
        size: bytesToSize(row.current_size),
        type: row.current_type,
    });
};

const downloadFilePublic = async (req, res) => {
    const publicKey = req.params.key;

    const [[fileVersion]] = await db.execute(
        `SELECT f.original_name, fv.storage_key 
        FROM file_versions fv
        JOIN files f ON f.id = fv.file
        WHERE f.public_key = ? AND fv.version = f.current_version AND fv.status = 'uploaded'`,
        [publicKey],
    );

    if (!fileVersion) {
        throw new CustomAPIError("File not found", 404);
    }

    const command = new GetObjectCommand({
        Bucket: process.env.MINIO_FILES_BUCKET,
        Key: fileVersion.storage_key,
        ResponseContentDisposition: `attachment; filename="${fileVersion.original_name}"`,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn: 30 });

    res.status(200).send({ url });
};

async function resolveParent(conn, id, parent, path, owner, excludeSelf = false ) {
    // excludeSelf = false : for files
    // excludeSelf = true : for folders

    if (!path) return null;

    const [deletedAncestors] = await conn.execute(
        `SELECT id FROM folders 
        WHERE ? LIKE CONCAT(path, '%')
        AND is_deleted = true AND owner = ?
        ${excludeSelf ? "AND id != ?" : ""}`,
        excludeSelf ? [path, owner, id] : [path, owner],
    );

    return deletedAncestors.length > 0 ? null : parent;
}

async function resolveFileName(conn, name, parent, owner) {
    const ext = path.extname(name);
    const base = path.basename(name, ext);

    const [existingRows] = await conn.execute(
        `SELECT original_name FROM files
        WHERE owner = ?
        AND (parent = ? OR (? IS NULL AND parent IS NULL)) 
        AND is_deleted = FALSE
        AND original_name LIKE ?`,
        [owner, parent, parent, `${base}%${ext}`]
    );

    if (existingRows.length === 0) return name;

    const existingNames = new Set(existingRows.map(r => r.original_name));
    let i = 0
    let newName;

    while (true) {
        newName = i === 0 ? name : `${base} (${i})${ext}`;
        if (!existingNames.has(newName)) break;
        i++;
    }
    
    return newName;
}

async function resolveFolderName(conn, name, parent, owner) {
    const [existingRows] = await conn.execute(
        `SELECT name FROM folders
        WHERE owner = ?
        AND (parent = ? OR (? IS NULL AND parent IS NULL)) 
        AND is_deleted = FALSE
        AND name LIKE ?`,
        [owner, parent, parent, `${name}%`]
    );

    if (existingRows.length === 0) return name;

    const existingNames = new Set(existingRows.map(r => r.name));
    let i = 0
    let newName;

    while (true) {
        newName = i === 0 ? name : `${name} (${i})`;
        if (!existingNames.has(newName)) break;
        i++;
    }
    
    return newName;
}

module.exports = {
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
