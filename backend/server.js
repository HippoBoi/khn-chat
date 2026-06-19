const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { URL } = require("url");
const { PutObjectCommand, S3Client } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { Pool } = require("pg");
const { Server } = require("socket.io");

loadEnvFile();

const port = process.env.PORT || 3001;
const clientUrl = process.env.CLIENT_URL || "*";
const allowedClientOrigins = parseAllowedOrigins(clientUrl);
const defaultConversationId = process.env.DEFAULT_CONVERSATION_ID || "public";
const messageHistoryLimit = Number(process.env.MESSAGE_HISTORY_LIMIT || 100);
const maxMessageTextLength = 1000;
const databaseUrl = process.env.DATABASE_URL;
const maxProfilePictureSizeBytes = 2 * 1024 * 1024;
const allowedProfilePictureTypes = new Map([
    ["image/png", "png"],
    ["image/jpeg", "jpg"],
    ["image/webp", "webp"],
]);

if (!databaseUrl) {
    throw new Error("DATABASE_URL is required. Add it to backend/.env before starting the server.");
}

const database = createPostgresDatabase({ connectionString: databaseUrl });

const server = http.createServer(async (req, res) => {
    try {
        setCorsHeaders(req, res);

        if (req.method === "OPTIONS") {
            res.writeHead(204);
            res.end();
            return;
        }

        const requestUrl = new URL(req.url, `http://${req.headers.host}`);

        if (req.method === "GET" && (requestUrl.pathname === "/" || requestUrl.pathname === "/health")) {
            sendJson(res, 200, { status: "ok" });
            return;
        }

        if (req.method === "POST" && requestUrl.pathname === "/uploads/profile-picture") {
            const payload = await readJsonBody(req);
            const upload = await createProfilePictureUpload(payload);

            sendJson(res, 201, upload);
            return;
        }

        if (req.method === "GET" && requestUrl.pathname === "/messages") {
            const conversationId = requestUrl.searchParams.get("conversationId") || defaultConversationId;
            const limit = Number(requestUrl.searchParams.get("limit") || messageHistoryLimit);
            const after = requestUrl.searchParams.get("after");
            const messages = await database.getMessages({ conversationId, limit, after });

            sendJson(res, 200, { messages });
            return;
        }

        const conversationMessagesMatch = requestUrl.pathname.match(/^\/conversations\/([^/]+)\/messages$/);
        if (req.method === "GET" && conversationMessagesMatch) {
            const conversationId = decodeURIComponent(conversationMessagesMatch[1]);
            const limit = Number(requestUrl.searchParams.get("limit") || messageHistoryLimit);
            const after = requestUrl.searchParams.get("after");
            const messages = await database.getMessages({ conversationId, limit, after });

            sendJson(res, 200, { messages });
            return;
        }

        if (req.method === "POST" && conversationMessagesMatch) {
            const conversationId = decodeURIComponent(conversationMessagesMatch[1]);
            const payload = await readJsonBody(req);
            const message = await saveIncomingMessage(payload, conversationId);

            io.to(conversationRoom(conversationId)).emit("message", message);
            sendJson(res, 201, { message });
            return;
        }

        sendJson(res, 404, { error: "Not found" });
    } catch (error) {
        sendJson(res, error.statusCode || 500, { error: error.message || "Internal server error" });
    }
});

const io = new Server(server, {
    cors: {
        origin: allowedClientOrigins === "*" ? "*" : allowedClientOrigins,
    },
});

io.on("connection", (socket) => {
    const conversationId = socket.handshake.query.conversationId || defaultConversationId;
    socket.join(conversationRoom(conversationId));

    socket.on("message", async (payload, ack) => {
        try {
            const message = await saveIncomingMessage(payload, payload.conversationId || conversationId);

            io.to(conversationRoom(message.conversationId)).emit("message", message);

            if (typeof ack === "function") {
                ack({ ok: true, message });
            }
        } catch (error) {
            if (typeof ack === "function") {
                ack({ ok: false, error: error.message });
            }
        }
    });
});

startServer().catch((error) => {
    console.error("failed to start server:", error.message);
    process.exit(1);
});

async function startServer() {
    await database.initialize();

    server.listen(port, () => {
        console.log("running on port " + port);
    });
}

async function saveIncomingMessage(payload, conversationId) {
    const cleanMessage = validateMessagePayload(payload, conversationId);
    return database.saveMessage(cleanMessage);
}

function validateMessagePayload(payload, conversationId) {
    if (!payload || typeof payload !== "object") {
        throw httpError(400, "Message payload is required");
    }

    const text = String(payload.text || "").trim().slice(0, maxMessageTextLength);
    const sender = String(payload.sender || "unnamed").trim();
    const profilePictureIndex = Number(payload.profilePictureIndex || 0);
    const profilePictureUrl = validateProfilePictureUrl(payload.profilePictureUrl);

    if (!text) {
        throw httpError(400, "Message text is required");
    }

    if (text.length > maxMessageTextLength) {
        throw httpError(400, "Message text is above limit");
    }

    return {
        conversationId: String(conversationId || defaultConversationId),
        text,
        sender: sender || "unnamed",
        profilePictureIndex: Number.isFinite(profilePictureIndex) ? profilePictureIndex : 0,
        profilePictureUrl,
    };
}

async function createProfilePictureUpload(payload) {
    const upload = validateProfilePictureUploadPayload(payload);
    const config = getS3ProfilePictureConfig();
    const objectKey = `profile-pictures/${crypto.randomUUID()}.${upload.extension}`;
    const publicUrl = `${config.publicBaseUrl}/${objectKey}`;
    const command = new PutObjectCommand({
        Bucket: config.bucket,
        Key: objectKey,
        ContentType: upload.contentType,
    });
    const uploadUrl = await getSignedUrl(config.client, command, { expiresIn: 300 });

    return {
        uploadUrl,
        publicUrl,
        key: objectKey,
    };
}

function getS3ProfilePictureConfig() {
    const bucket = process.env.S3_PROFILE_PICTURES_BUCKET;
    const publicBaseUrl = normalizeUrlBase(process.env.S3_PROFILE_PICTURES_PUBLIC_BASE_URL);

    if (!process.env.AWS_REGION || !bucket || !publicBaseUrl) {
        throw httpError(500, "S3 profile picture uploads are not configured");
    }

    return {
        bucket,
        publicBaseUrl,
        client: new S3Client({
            region: process.env.AWS_REGION,
            requestChecksumCalculation: "WHEN_REQUIRED",
        }),
    };
}

function validateProfilePictureUploadPayload(payload) {
    if (!payload || typeof payload !== "object") {
        throw httpError(400, "Upload metadata is required");
    }

    const contentType = String(payload.contentType || "").toLowerCase();
    const sizeBytes = Number(payload.sizeBytes);
    const extension = allowedProfilePictureTypes.get(contentType);

    if (!extension) {
        throw httpError(400, "Profile picture must be a PNG, JPG, or WebP image");
    }

    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
        throw httpError(400, "Profile picture size is required");
    }

    if (sizeBytes > maxProfilePictureSizeBytes) {
        throw httpError(400, "Profile picture must be 2 MB or smaller");
    }

    return {
        contentType,
        sizeBytes,
        extension,
    };
}

function validateProfilePictureUrl(value) {
    if (!value) {
        return null;
    }

    const profilePictureUrl = String(value).trim();
    const publicBaseUrl = normalizeUrlBase(process.env.S3_PROFILE_PICTURES_PUBLIC_BASE_URL);

    if (!publicBaseUrl || !profilePictureUrl.startsWith(`${publicBaseUrl}/profile-pictures/`)) {
        throw httpError(400, "Profile picture URL is not allowed");
    }

    return profilePictureUrl;
}

function createPostgresDatabase(config) {
    const pool = new Pool({
        connectionString: config.connectionString,
        ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    });

    return {
        async initialize() {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS messages (
                    id UUID PRIMARY KEY,
                    conversation_id TEXT NOT NULL,
                    text TEXT NOT NULL,
                    sender TEXT NOT NULL,
                    timestamp BIGINT NOT NULL,
                    profile_picture_index INTEGER NOT NULL DEFAULT 0,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );

                CREATE INDEX IF NOT EXISTS messages_conversation_timestamp_idx
                    ON messages (conversation_id, timestamp);
            `);

            await pool.query(`
                ALTER TABLE messages
                ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;
            `);
        },

        async saveMessage(message) {
            const id = crypto.randomUUID();
            const timestamp = Date.now();

            const result = await pool.query(
                `
                    INSERT INTO messages (
                        id,
                        conversation_id,
                        text,
                        sender,
                        timestamp,
                        profile_picture_index,
                        profile_picture_url
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    RETURNING
                        id,
                        conversation_id,
                        text,
                        sender,
                        timestamp,
                        profile_picture_index,
                        profile_picture_url
                `,
                [
                    id,
                    message.conversationId,
                    message.text,
                    message.sender,
                    timestamp,
                    message.profilePictureIndex,
                    message.profilePictureUrl,
                ]
            );

            return mapMessageRow(result.rows[0]);
        },

        async getMessages({ conversationId, limit, after }) {
            const safeLimit = Math.min(Math.max(Number(limit) || messageHistoryLimit, 1), 500);
            const afterTimestamp = Number(after);
            const params = [conversationId, safeLimit];
            let afterClause = "";

            if (after && Number.isFinite(afterTimestamp)) {
                params.push(afterTimestamp);
                afterClause = "AND timestamp > $3";
            }

            const result = await pool.query(
                `
                    SELECT
                        id,
                        conversation_id,
                        text,
                        sender,
                        timestamp,
                        profile_picture_index,
                        profile_picture_url
                    FROM messages
                    WHERE conversation_id = $1
                    ${afterClause}
                    ORDER BY timestamp DESC
                    LIMIT $2
                `,
                params
            );

            return result.rows.reverse().map(mapMessageRow);
        },
    };
}

function mapMessageRow(row) {
    return {
        id: row.id,
        conversationId: row.conversation_id,
        text: row.text,
        sender: row.sender,
        timestamp: Number(row.timestamp),
        profilePictureIndex: row.profile_picture_index,
        profilePictureUrl: row.profile_picture_url,
    };
}

function loadEnvFile() {
    const envPath = path.join(__dirname, ".env");

    if (!fs.existsSync(envPath)) {
        return;
    }

    const envFile = fs.readFileSync(envPath, "utf8");
    for (const line of envFile.split(/\r?\n/)) {
        const trimmed = line.trim();

        if (!trimmed || trimmed.startsWith("#")) {
            continue;
        }

        const separatorIndex = trimmed.indexOf("=");
        if (separatorIndex === -1) {
            continue;
        }

        const key = trimmed.slice(0, separatorIndex).trim();
        const rawValue = trimmed.slice(separatorIndex + 1).trim();
        const value = rawValue.replace(/^["']|["']$/g, "");

        if (!process.env[key]) {
            process.env[key] = value;
        }
    }
}

function parseAllowedOrigins(value) {
    if (!value || value === "*") {
        return "*";
    }

    return value
        .split(",")
        .map((origin) => normalizeOrigin(origin))
        .filter(Boolean);
}

function normalizeOrigin(origin) {
    return String(origin || "").trim().replace(/\/$/, "");
}

function normalizeUrlBase(url) {
    return String(url || "").trim().replace(/\/+$/, "");
}

function conversationRoom(conversationId) {
    return `conversation:${conversationId}`;
}

function sendJson(res, statusCode, payload) {
    res.writeHead(statusCode, { "Content-Type": "application/json" });
    res.end(JSON.stringify(payload));
}

function setCorsHeaders(req, res) {
    const requestOrigin = normalizeOrigin(req.headers.origin);

    if (allowedClientOrigins === "*") {
        res.setHeader("Access-Control-Allow-Origin", "*");
    } else if (allowedClientOrigins.includes(requestOrigin)) {
        res.setHeader("Access-Control-Allow-Origin", requestOrigin);
    }

    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function readJsonBody(req) {
    return new Promise((resolve, reject) => {
        let body = "";

        req.on("data", (chunk) => {
            body += chunk;

            if (body.length > 1024 * 1024) {
                reject(httpError(413, "Request body is too large"));
                req.destroy();
            }
        });

        req.on("end", () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch {
                reject(httpError(400, "Invalid JSON body"));
            }
        });

        req.on("error", reject);
    });
}

function httpError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}
