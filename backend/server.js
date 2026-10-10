const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { URL } = require("url");
const { PutObjectCommand, S3Client } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { Pool } = require("pg");
const { Server } = require("socket.io");
const { initializeApp: initializeFirebaseApp, cert } = require("firebase-admin/app");
const { getMessaging } = require("firebase-admin/messaging");

loadEnvFile();

const port = process.env.PORT || 3001;
const clientUrl = process.env.CLIENT_URL || "*";
const nativeClientOrigins = ["https://localhost", "http://localhost", "capacitor://localhost"];
const allowedClientOrigins = parseAllowedOrigins(clientUrl, nativeClientOrigins);
const defaultConversationId = process.env.DEFAULT_CONVERSATION_ID || "public";
const messageHistoryLimit = Number(process.env.MESSAGE_HISTORY_LIMIT || 100);
const notificationHistoryLimit = Number(process.env.NOTIFICATION_HISTORY_LIMIT || 100);
const appAndroidLatestVersionCode = Number(process.env.APP_ANDROID_LATEST_VERSION_CODE || 1);
const appAndroidLatestVersionName = process.env.APP_ANDROID_LATEST_VERSION_NAME || "1";
const appAndroidDownloadUrl = process.env.APP_ANDROID_DOWNLOAD_URL || "";
const appAndroidUpdateMessage = process.env.APP_ANDROID_UPDATE_MESSAGE || "old version error";
const maxMessageTextLength = 1000;
const maxPingedUsers = 20;
const databaseUrl = process.env.DATABASE_URL;
const userIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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
let firebaseMessaging = null;

function resolveFirebaseServiceAccount() {
    const jsonFromEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    if (jsonFromEnv) {
        try {
            return JSON.parse(jsonFromEnv);
        } catch (error) {
            console.error("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON:", error.message);
            return null;
        }
    }

    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

    if (serviceAccountPath) {
        if (!fs.existsSync(serviceAccountPath)) {
            console.error("FIREBASE_SERVICE_ACCOUNT_PATH points to a missing file; push notifications disabled.");
            return null;
        }

        return serviceAccountPath;
    }

    return null;
}

function initializeFirebaseMessaging() {
    const serviceAccount = resolveFirebaseServiceAccount();

    if (!serviceAccount) {
        console.error("FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH missing; push notifications disabled.");
        return;
    }

    try {
        initializeFirebaseApp({
            credential: cert(serviceAccount),
        });
        firebaseMessaging = getMessaging();
        console.log("firebase messaging initialized for push notifications.");
    } catch (error) {
        console.error("failed to initialize firebase messaging:", error.message);
    }
}

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

        if (req.method === "GET" && requestUrl.pathname === "/app-version") {
            sendJson(res, 200, {
                android: {
                    latestVersionCode: appAndroidLatestVersionCode,
                    latestVersionName: appAndroidLatestVersionName,
                    downloadUrl: appAndroidDownloadUrl,
                    message: appAndroidUpdateMessage,
                },
            });
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

        if (req.method === "GET" && requestUrl.pathname === "/notifications") {
            const userId = validateUserId(requestUrl.searchParams.get("userId"));
            const limit = Number(requestUrl.searchParams.get("limit") || notificationHistoryLimit);
            const after = requestUrl.searchParams.get("after");
            const notifications = await database.getNotifications({ userId, limit, after });
            const unreadCount = await database.countUnreadNotifications(userId);

            sendJson(res, 200, { notifications, unreadCount });
            return;
        }

        if (req.method === "POST" && requestUrl.pathname === "/notifications/read") {
            const payload = await readJsonBody(req);
            const userId = validateUserId(payload.userId);

            if (!userId) {
                throw httpError(400, "User ID is required");
            }

            const result = await database.markNotificationsRead({
                userId,
                id: payload.id,
                conversationId: payload.conversationId,
            });

            if (payload.id) {
                io.to(userRoom(userId)).emit("notifications-read", { id: payload.id });
            } else if (payload.conversationId) {
                io.to(userRoom(userId)).emit("notifications-read", {
                    conversationId: payload.conversationId,
                });
            } else {
                io.to(userRoom(userId)).emit("notifications-read", { all: true });
            }

            sendJson(res, 200, result);
            return;
        }

        if (req.method === "POST" && requestUrl.pathname === "/push/subscribe") {
            const payload = await readJsonBody(req);
            const userId = validateUserId(payload.userId);
            const token = validatePushToken(payload.token);

            if (!userId) {
                throw httpError(400, "User ID is required");
            }

            if (!token) {
                throw httpError(400, "Push token is required");
            }

            await database.savePushSubscription({
                userId,
                token,
                conversationId: payload.conversationId || defaultConversationId,
            });

            sendJson(res, 201, { ok: true });
            return;
        }

        if (req.method === "DELETE" && requestUrl.pathname === "/push/subscribe") {
            const payload = await readJsonBody(req);
            const userId = validateUserId(payload.userId);
            const token = validatePushToken(payload.token);

            if (userId && token) {
                await database.removePushSubscription({ userId, token });
            }

            sendJson(res, 200, { ok: true });
            return;
        }

        if (req.method === "GET" && requestUrl.pathname === "/users") {
            const excludeUserId = requestUrl.searchParams.get("exclude") || requestUrl.searchParams.get("excludeUserId");
            const users = await database.listUsers({
                excludeUserId: excludeUserId || null,
                query: requestUrl.searchParams.get("q") || "",
                limit: Number(requestUrl.searchParams.get("limit") || 50),
            });

            sendJson(res, 200, { users });
            return;
        }

        if (req.method === "GET" && requestUrl.pathname === "/conversations") {
            const userId = validateUserId(requestUrl.searchParams.get("userId"));

            if (!userId) {
                throw httpError(400, "User ID is required");
            }

            const conversations = await database.getConversationsForUser(userId);

            sendJson(res, 200, { conversations });
            return;
        }

        if (req.method === "POST" && requestUrl.pathname === "/conversations") {
            const payload = await readJsonBody(req);
            const conversation = await createConversation(payload);

            for (const memberId of conversation.memberIds) {
                io.to(userRoom(memberId)).emit("conversation-invite", { conversation });
            }

            sendJson(res, 201, { conversation });
            return;
        }

        if (req.method === "GET" && requestUrl.pathname === "/notifications/unread-by-conversation") {
            const userId = validateUserId(requestUrl.searchParams.get("userId"));

            if (!userId) {
                throw httpError(400, "User ID is required");
            }

            const unreadByConversation = await database.countUnreadByConversation(userId);

            sendJson(res, 200, { unreadByConversation });
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
            await notifyRecipients(message);
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
    socket.data.conversationId = String(conversationId);
    socket.join(conversationRoom(socket.data.conversationId));

    socket.on("identify", (payload) => {
        const userId = validateUserId(payload && payload.userId);

        if (userId) {
            socket.data.userId = userId;
            socket.join(userRoom(userId));
            database.ensurePublicMembership(userId).catch(() => {});
        }
    });

    socket.on("join-conversation", (payload) => {
        const nextId = String((payload && payload.conversationId) || defaultConversationId);
        const previousId = socket.data.conversationId;

        if (previousId && previousId !== nextId) {
            socket.leave(conversationRoom(previousId));
        }

        socket.data.conversationId = nextId;
        socket.join(conversationRoom(nextId));
    });

    socket.on("message", async (payload, ack) => {
        try {
            const message = await saveIncomingMessage(payload, payload.conversationId || conversationId);

            io.to(conversationRoom(message.conversationId)).emit("message", message);
            await notifyRecipients(message);

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
    initializeFirebaseMessaging();
    await database.initialize();

    server.listen(port, () => {
        console.log("running on port " + port);
    });
}

async function saveIncomingMessage(payload, conversationId) {
    const cleanMessage = validateMessagePayload(payload, conversationId);
    return database.saveMessage(cleanMessage);
}

async function createConversation(payload) {
    if (!payload || typeof payload !== "object") {
        throw httpError(400, "Conversation payload is required");
    }

    const name = String(payload.name || "").trim().slice(0, 80);

    if (!name) {
        throw httpError(400, "Conversation name is required");
    }

    const createdBy = validateUserId(payload.createdBy || payload.userId);
    const memberIds = validateConversationMemberIds(payload.memberIds || payload.userIds, createdBy);

    if (createdBy && !memberIds.includes(createdBy)) {
        memberIds.push(createdBy);
    }

    if (memberIds.length === 0) {
        throw httpError(400, "At least one member is required");
    }

    return database.createConversation({ name, memberIds, createdBy });
}

function validateConversationMemberIds(value, excludeUserId) {
    if (value === undefined || value === null) {
        return [];
    }

    if (!Array.isArray(value)) {
        throw httpError(400, "memberIds must be an array");
    }

    const seen = new Set();
    const memberIds = [];

    for (const rawValue of value) {
        if (memberIds.length >= 20) {
            break;
        }

        const memberId = validateUserId(rawValue);

        if (!memberId || seen.has(memberId)) {
            continue;
        }

        seen.add(memberId);
        memberIds.push(memberId);
    }

    return memberIds;
}

async function notifyRecipients(message) {
    const recipientUserIds = message.pingedUserIds || [];

    if (recipientUserIds.length === 0) {
        return;
    }

    for (const userId of recipientUserIds) {
        const notification = await database.saveNotification({
            userId,
            conversationId: message.conversationId,
            type: "message",
            title: message.sender,
            body: message.text,
            data: {
                messageId: message.id,
                profilePictureUrl: message.profilePictureUrl || null,
                profilePictureIndex: message.profilePictureIndex,
                pingedUserIds: recipientUserIds,
            },
        });

        io.to(userRoom(userId)).emit("notification", notification);
    }

    if (firebaseMessaging) {
        await sendPushNotifications(message, recipientUserIds);
    } else {
        console.log("push: firebase messaging not initialized; device push skipped.");
    }
}

async function sendPushNotifications(message, recipientUserIds) {
    if (recipientUserIds.length === 0) {
        return;
    }

    const subscriptions = await database.getPushSubscriptionsForUserIds(recipientUserIds);
    if (subscriptions.length === 0) {
        console.log(`push: no stored subscriptions for recipient(s) ${recipientUserIds.length}; skipping.`);
        return;
    }

    const tokens = subscriptions.map((subscription) => subscription.token);

    try {
        const response = await firebaseMessaging.sendEachForMulticast({
            tokens,
            notification: {
                title: message.sender,
                body: message.text,
            },
            data: {
                title: message.sender,
                body: message.text,
                conversationId: message.conversationId,
                messageId: message.id,
                profilePictureUrl: message.profilePictureUrl || "",
            },
        });

        const failed = response.responses.filter((result) => !result.success).length;
        console.log(`push: sent to ${tokens.length} token(s), ${failed} failed.`);

        response.responses.forEach((result, index) => {
            if (!result.success && result.error) {
                console.log(
                    `push: token[${index}] failed: ${result.error.code || "unknown"} - ${result.error.message || ""}`
                );
            }
        });

        const staleTokens = response.responses
            .map((result, index) => (result.success ? null : tokens[index]))
            .filter(Boolean);

        for (const token of staleTokens) {
            await database.deletePushSubscriptionByToken(token);
        }
    } catch (error) {
        console.error("failed to send push notifications:", error.message);
    }
}

function validateMessagePayload(payload, conversationId) {
    if (!payload || typeof payload !== "object") {
        throw httpError(400, "Message payload is required");
    }

    const text = String(payload.text || "").trim().slice(0, maxMessageTextLength);
    const sender = String(payload.sender || "unnamed").trim();
    const userId = validateUserId(payload.userId);
    const profilePictureIndex = Number(payload.profilePictureIndex || 0);
    const profilePictureUrl = validateProfilePictureUrl(payload.profilePictureUrl);
    const pingedUserIds = validatePingedUserIds(payload.pingedUserIds, userId);

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
        userId,
        profilePictureIndex: Number.isFinite(profilePictureIndex) ? profilePictureIndex : 0,
        profilePictureUrl,
        pingedUserIds,
    };
}

function validateUserId(value) {
    if (value === undefined || value === null || value === "") {
        return null;
    }

    const userId = String(value).trim();

    if (!userIdPattern.test(userId)) {
        throw httpError(400, "User ID must be a valid UUID");
    }

    return userId;
}

function validatePingedUserIds(value, excludeUserId) {
    if (value === undefined || value === null) {
        return [];
    }

    if (!Array.isArray(value)) {
        throw httpError(400, "pingedUserIds must be an array");
    }

    const seen = new Set();
    const pingedUserIds = [];

    for (const rawValue of value) {
        if (pingedUserIds.length >= maxPingedUsers) {
            break;
        }

        const pingedUserId = validateUserId(rawValue);

        if (!pingedUserId || pingedUserId === excludeUserId || seen.has(pingedUserId)) {
            continue;
        }

        seen.add(pingedUserId);
        pingedUserIds.push(pingedUserId);
    }

    return pingedUserIds;
}

function validatePushToken(value) {
    if (value === undefined || value === null) {
        return null;
    }

    const token = String(value).trim();

    if (!token || token.length > 4096) {
        return null;
    }

    return token;
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

                ALTER TABLE messages
                ADD COLUMN IF NOT EXISTS user_id UUID;

                ALTER TABLE messages
                ADD COLUMN IF NOT EXISTS pinged_user_ids JSONB;
            `);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS notifications (
                    id UUID PRIMARY KEY,
                    user_id UUID NOT NULL,
                    conversation_id TEXT NOT NULL,
                    type TEXT NOT NULL DEFAULT 'message',
                    title TEXT NOT NULL,
                    body TEXT NOT NULL,
                    data JSONB,
                    is_read BOOLEAN NOT NULL DEFAULT FALSE,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );

                CREATE INDEX IF NOT EXISTS notifications_user_created_idx
                    ON notifications (user_id, created_at DESC);
            `);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS push_subscriptions (
                    id UUID PRIMARY KEY,
                    user_id UUID NOT NULL,
                    token TEXT NOT NULL,
                    conversation_id TEXT NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    UNIQUE (user_id, token)
                );

                CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx
                    ON push_subscriptions (user_id);
            `);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS conversations (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    created_by UUID,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );

                CREATE TABLE IF NOT EXISTS conversation_members (
                    conversation_id TEXT NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
                    user_id UUID NOT NULL,
                    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    PRIMARY KEY (conversation_id, user_id)
                );

                CREATE INDEX IF NOT EXISTS conversation_members_user_idx
                    ON conversation_members (user_id);
            `);

            await pool.query(
                `
                    INSERT INTO conversations (id, name)
                    VALUES ($1, $2)
                    ON CONFLICT (id) DO NOTHING
                `,
                [defaultConversationId, "General"]
            );

            await pool.query(
                `
                    UPDATE conversations
                    SET name = $2
                    WHERE id = $1 AND name = $3
                `,
                [defaultConversationId, "General", "Public"]
            );
        },

        async ensurePublicMembership(userId) {
            if (!userId) {
                return;
            }

            await pool.query(
                `
                    INSERT INTO conversations (id, name)
                    VALUES ($1, $2)
                    ON CONFLICT (id) DO NOTHING
                `,
                [defaultConversationId, "General"]
            );

            await pool.query(
                `
                    INSERT INTO conversation_members (conversation_id, user_id)
                    VALUES ($1, $2)
                    ON CONFLICT DO NOTHING
                `,
                [defaultConversationId, userId]
            );
        },

        async saveMessage(message) {
            const id = crypto.randomUUID();
            const timestamp = Date.now();

            if (message.userId && message.conversationId === defaultConversationId) {
                await pool.query(
                    `
                        INSERT INTO conversation_members (conversation_id, user_id)
                        VALUES ($1, $2)
                        ON CONFLICT DO NOTHING
                    `,
                    [defaultConversationId, message.userId]
                );
            }

            const result = await pool.query(
                `
                    INSERT INTO messages (
                        id,
                        conversation_id,
                        text,
                        sender,
                        user_id,
                        timestamp,
                        profile_picture_index,
                        profile_picture_url,
                        pinged_user_ids
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    RETURNING
                        id,
                        conversation_id,
                        text,
                        sender,
                        user_id,
                        timestamp,
                        profile_picture_index,
                        profile_picture_url,
                        pinged_user_ids
                `,
                [
                    id,
                    message.conversationId,
                    message.text,
                    message.sender,
                    message.userId,
                    timestamp,
                    message.profilePictureIndex,
                    message.profilePictureUrl,
                    JSON.stringify(message.pingedUserIds || []),
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
                        user_id,
                        timestamp,
                        profile_picture_index,
                        profile_picture_url,
                        pinged_user_ids
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

        async saveNotification(notification) {
            const id = crypto.randomUUID();

            const result = await pool.query(
                `
                    INSERT INTO notifications (
                        id,
                        user_id,
                        conversation_id,
                        type,
                        title,
                        body,
                        data
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    RETURNING
                        id,
                        user_id,
                        conversation_id,
                        type,
                        title,
                        body,
                        data,
                        is_read,
                        created_at
                `,
                [
                    id,
                    notification.userId,
                    notification.conversationId,
                    notification.type || "message",
                    notification.title,
                    notification.body,
                    JSON.stringify(notification.data || {}),
                ]
            );

            return mapNotificationRow(result.rows[0]);
        },

        async getNotifications({ userId, limit, after }) {
            if (!userId) {
                return [];
            }

            const safeLimit = Math.min(Math.max(Number(limit) || notificationHistoryLimit, 1), 500);
            const afterDate = new Date(Number(after));
            const params = [userId, safeLimit];
            let afterClause = "";

            if (after && Number.isFinite(afterDate.getTime())) {
                params.push(afterDate);
                afterClause = "AND created_at < $3";
            }

            const result = await pool.query(
                `
                    SELECT
                        id,
                        user_id,
                        conversation_id,
                        type,
                        title,
                        body,
                        data,
                        is_read,
                        created_at
                    FROM notifications
                    WHERE user_id = $1
                    ${afterClause}
                    ORDER BY created_at DESC
                    LIMIT $2
                `,
                params
            );

            return result.rows.map(mapNotificationRow);
        },

        async markNotificationsRead({ userId, id, conversationId }) {
            if (!userId) {
                return { updated: 0 };
            }

            const params = [userId];
            let extraClause = "";

            if (id) {
                params.push(id);
                extraClause = "AND id = $2";
            } else if (conversationId) {
                params.push(String(conversationId));
                extraClause = "AND conversation_id = $2";
            }

            const result = await pool.query(
                `
                    UPDATE notifications
                    SET is_read = TRUE
                    WHERE user_id = $1
                    ${extraClause}
                `,
                params
            );

            return { updated: result.rowCount };
        },

        async countUnreadNotifications(userId) {
            if (!userId) {
                return 0;
            }

            const result = await pool.query(
                `
                    SELECT COUNT(*)::int AS count
                    FROM notifications
                    WHERE user_id = $1 AND is_read = FALSE
                `,
                [userId]
            );

            return result.rows[0].count;
        },

        async savePushSubscription({ userId, token, conversationId }) {
            await pool.query(
                `
                    INSERT INTO push_subscriptions (id, user_id, token, conversation_id)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (user_id, token) DO UPDATE
                        SET conversation_id = EXCLUDED.conversation_id
                `,
                [crypto.randomUUID(), userId, token, conversationId]
            );
        },

        async removePushSubscription({ userId, token }) {
            await pool.query(
                `
                    DELETE FROM push_subscriptions
                    WHERE user_id = $1 AND token = $2
                `,
                [userId, token]
            );
        },

        async deletePushSubscriptionByToken(token) {
            await pool.query(
                `
                    DELETE FROM push_subscriptions
                    WHERE token = $1
                `,
                [token]
            );
        },

        async getPushSubscriptionsForUserIds(userIds) {
            if (userIds.length === 0) {
                return [];
            }

            const result = await pool.query(
                `
                    SELECT user_id, token
                    FROM push_subscriptions
                    WHERE user_id = ANY($1)
                `,
                [userIds]
            );

            return result.rows;
        },

        async createConversation({ name, memberIds, createdBy }) {
            const id = crypto.randomUUID();
            const client = await pool.connect();

            try {
                await client.query("BEGIN");
                await client.query(
                    `
                        INSERT INTO conversations (id, name, created_by)
                        VALUES ($1, $2, $3)
                    `,
                    [id, name, createdBy]
                );

                for (const memberId of memberIds) {
                    await client.query(
                        `
                            INSERT INTO conversation_members (conversation_id, user_id)
                            VALUES ($1, $2)
                            ON CONFLICT DO NOTHING
                        `,
                        [id, memberId]
                    );
                }

                await client.query("COMMIT");
            } catch (error) {
                await client.query("ROLLBACK");
                throw error;
            } finally {
                client.release();
            }

            const members = await this.getConversationMembers(id);

            return {
                id,
                name,
                createdBy,
                createdAt: Date.now(),
                memberIds: members,
            };
        },

        async getConversationMembers(conversationId) {
            const result = await pool.query(
                `
                    SELECT user_id
                    FROM conversation_members
                    WHERE conversation_id = $1
                    ORDER BY joined_at ASC
                `,
                [conversationId]
            );

            return result.rows.map((row) => row.user_id);
        },

        async getConversationsForUser(userId) {
            if (!userId) {
                return [];
            }

            await this.ensurePublicMembership(userId);

            const result = await pool.query(
                `
                    SELECT
                        c.id,
                        c.name,
                        c.created_by,
                        c.created_at,
                        COALESCE(m.last_message_at, NULL) AS last_message_at,
                        (
                            SELECT COUNT(*)
                            FROM conversation_members cm2
                            WHERE cm2.conversation_id = c.id
                        )::int AS member_count
                    FROM conversations c
                    INNER JOIN conversation_members cm ON cm.conversation_id = c.id
                    LEFT JOIN (
                        SELECT conversation_id, MAX(timestamp) AS last_message_at
                        FROM messages
                        GROUP BY conversation_id
                    ) m ON m.conversation_id = c.id
                    WHERE cm.user_id = $1
                    ORDER BY COALESCE(m.last_message_at, 0) DESC, c.created_at DESC
                `,
                [userId]
            );

            const memberRows = await pool.query(
                `
                    SELECT conversation_id, user_id
                    FROM conversation_members
                    WHERE conversation_id IN (
                        SELECT conversation_id
                        FROM conversation_members
                        WHERE user_id = $1
                    )
                `,
                [userId]
            );

            const membersByConversation = new Map();

            for (const row of memberRows.rows) {
                if (!membersByConversation.has(row.conversation_id)) {
                    membersByConversation.set(row.conversation_id, []);
                }

                membersByConversation.get(row.conversation_id).push(row.user_id);
            }

            return result.rows.map((row) => ({
                id: row.id,
                name: row.name,
                createdBy: row.created_by,
                createdAt: new Date(row.created_at).getTime(),
                lastMessageAt: row.last_message_at ? Number(row.last_message_at) : null,
                memberCount: row.member_count,
                memberIds: membersByConversation.get(row.id) || [],
            }));
        },

        async listUsers({ excludeUserId, query, limit }) {
            const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
            const params = [];
            let excludeClause = "";
            let searchClause = "";

            if (excludeUserId) {
                params.push(excludeUserId);
                excludeClause = `WHERE ranked.user_id != $${params.length}`;
            }

            if (query && String(query).trim()) {
                params.push(`%${String(query).trim()}%`);
                searchClause = `${excludeClause ? "AND" : "WHERE"} ranked.username ILIKE $${params.length}`;
            }

            params.push(safeLimit);

            const result = await pool.query(
                `
                    WITH combined AS (
                        SELECT user_id, sender AS username, timestamp AS seen_at
                        FROM messages
                        WHERE user_id IS NOT NULL
                        UNION ALL
                        SELECT user_id, title AS username, EXTRACT(EPOCH FROM created_at) * 1000 AS seen_at
                        FROM notifications
                        WHERE user_id IS NOT NULL
                        UNION ALL
                        SELECT user_id, NULL AS username, EXTRACT(EPOCH FROM created_at) * 1000 AS seen_at
                        FROM push_subscriptions
                        WHERE user_id IS NOT NULL
                    ),
                    ranked AS (
                        SELECT
                            user_id,
                            MAX(username) AS username,
                            MAX(seen_at) AS last_seen
                        FROM combined
                        GROUP BY user_id
                    )
                    SELECT user_id, username, last_seen
                    FROM ranked
                    ${excludeClause}
                    ${searchClause}
                    ORDER BY last_seen DESC
                    LIMIT $${params.length}
                `,
                params
            );

            return result.rows.map((row) => ({
                userId: row.user_id,
                username: row.username || "unnamed",
                lastSeen: row.last_seen ? Number(row.last_seen) : null,
            }));
        },

        async countUnreadByConversation(userId) {
            if (!userId) {
                return {};
            }

            const result = await pool.query(
                `
                    SELECT conversation_id, COUNT(*)::int AS count
                    FROM notifications
                    WHERE user_id = $1 AND is_read = FALSE
                    GROUP BY conversation_id
                `,
                [userId]
            );

            const counts = {};

            for (const row of result.rows) {
                counts[row.conversation_id] = row.count;
            }

            return counts;
        },
    };
}

function mapMessageRow(row) {
    return {
        id: row.id,
        conversationId: row.conversation_id,
        text: row.text,
        sender: row.sender,
        userId: row.user_id,
        timestamp: Number(row.timestamp),
        profilePictureIndex: row.profile_picture_index,
        profilePictureUrl: row.profile_picture_url,
        pingedUserIds: row.pinged_user_ids || [],
    };
}

function mapNotificationRow(row) {
    return {
        id: row.id,
        userId: row.user_id,
        conversationId: row.conversation_id,
        type: row.type,
        title: row.title,
        body: row.body,
        data: row.data,
        isRead: row.is_read,
        createdAt: new Date(row.created_at).getTime(),
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

function parseAllowedOrigins(value, extraOrigins = []) {
    if (!value || value === "*") {
        return "*";
    }

    return Array.from(
        new Set([
            ...value
                .split(",")
                .map((origin) => normalizeOrigin(origin))
                .filter(Boolean),
            ...extraOrigins,
        ])
    );
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

function userRoom(userId) {
    return `user:${userId}`;
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
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
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
