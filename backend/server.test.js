const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { Readable } = require("node:stream");
const { test } = require("node:test");
const vm = require("node:vm");

const creatorId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const inviteeId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const secondInviteeId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function createTestServer({ pushEnabled = true, subscriptions = [], failCreation = false } = {}) {
    const notifications = [];
    const events = [];
    const pushes = [];
    const deletedTokens = [];
    let handler;

    // Isolate startup and external services; exercise the actual HTTP handler and notification helpers.
    const dependencies = {
        fs: { existsSync: () => false },
        http: {
            createServer(callback) {
                handler = callback;
                return { listen() {} };
            },
        },
        pg: { Pool: class { async query() { return { rows: [] }; } } },
        "socket.io": {
            Server: class {
                on() {}
                to(room) {
                    return { emit: (event, payload) => events.push({ room, event, payload }) };
                }
            },
        },
        "@aws-sdk/client-s3": {},
        "@aws-sdk/s3-request-presigner": {},
        "firebase-admin/app": {},
        "firebase-admin/messaging": {},
    };
    const context = vm.createContext({
        require: (name) => dependencies[name] || require(name),
        __dirname,
        Buffer,
        console: { log() {}, error() {} },
        process: { env: { DATABASE_URL: "postgres://test" }, exit() { throw new Error("Unexpected exit"); } },
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname, "server.js"), "utf8"), context);
    const database = vm.runInContext("database", context);

    Object.assign(database, {
        async createConversation(conversation) {
            if (failCreation) throw new Error("Creation failed");
            return {
                ...conversation,
                id: crypto.randomUUID(),
                memberIds: [...new Set(conversation.memberIds.map((id) => id.toLowerCase()))],
            };
        },
        async saveNotification(payload) {
            const notification = { ...payload, id: crypto.randomUUID(), isRead: false, createdAt: Date.now() };
            notifications.push(notification);
            return notification;
        },
        async getNotifications({ userId }) {
            return notifications.filter((notification) => notification.userId === userId);
        },
        async countUnreadNotifications(userId) {
            return notifications.filter((notification) => notification.userId === userId && !notification.isRead).length;
        },
        async getPushSubscriptionsForUserIds(userIds) {
            return subscriptions.filter((subscription) => userIds.includes(subscription.userId));
        },
        async deletePushSubscriptionByToken(token) { deletedTokens.push(token); },
        async saveMessage(message) { return { ...message, id: crypto.randomUUID() }; },
    });

    if (pushEnabled) {
        context.testMessaging = {
            async sendEachForMulticast(payload) {
                pushes.push(payload);
                return { responses: payload.tokens.map(() => ({ success: true })) };
            },
        };
        vm.runInContext("firebaseMessaging = testMessaging", context);
    }

    async function request(method, url, payload) {
        const req = Readable.from(payload ? [JSON.stringify(payload)] : []);
        Object.assign(req, { method, url, headers: { host: "localhost" } });
        const response = { setHeader() {}, writeHead(status) { this.status = status; }, end(body) { this.body = JSON.parse(body); } };
        await handler(req, response);
        return response;
    }

    return { request, notifications, events, pushes, deletedTokens };
}

test("creating a chat notifies each invitee once using history, sockets, and push", async () => {
    const server = createTestServer({
        subscriptions: [creatorId, inviteeId, secondInviteeId].map((userId) => ({ userId, token: `token-${userId}` })),
    });
    const response = await server.request("POST", "/conversations", {
        name: "  Weekend plans  ",
        createdBy: creatorId,
        memberIds: [creatorId, inviteeId, inviteeId, secondInviteeId],
    });

    assert.equal(response.status, 201);
    const conversationId = response.body.conversation.id;
    assert.deepEqual(server.notifications.map((notification) => notification.userId), [inviteeId, secondInviteeId]);
    for (const notification of server.notifications) {
        assert.equal(notification.conversationId, conversationId);
        assert.equal(notification.type, "system");
        assert.equal(notification.body, "You have been invited to Weekend plans");
        assert.equal(notification.isRead, false);
    }
    assert.equal(server.events.filter(({ event }) => event === "conversation-invite").length, 3);
    assert.deepEqual(server.events.filter(({ event }) => event === "notification").map(({ room }) => room), [
        `user:${inviteeId}`, `user:${secondInviteeId}`,
    ]);
    assert.equal(server.pushes.length, 1);
    assert.deepEqual(Array.from(server.pushes[0].tokens), [`token-${inviteeId}`, `token-${secondInviteeId}`]);
    assert.equal(server.pushes[0].notification.body, "You have been invited to Weekend plans");
    assert.equal(server.pushes[0].data.body, "You have been invited to Weekend plans");
    assert.equal(server.pushes[0].data.conversationId, conversationId);
    assert.equal("messageId" in server.pushes[0].data, false);
});

test("an offline invitee can retrieve the saved notification without push enabled", async () => {
    const server = createTestServer({ pushEnabled: false });
    await server.request("POST", "/conversations", { name: "New chat", createdBy: creatorId, memberIds: [inviteeId] });
    const response = await server.request("GET", `/notifications?userId=${inviteeId}`);
    assert.equal(response.status, 200);
    assert.equal(response.body.unreadCount, 1);
    assert.equal(response.body.notifications[0].body, "You have been invited to New chat");
    assert.equal(server.pushes.length, 0);
});

test("a creator-only chat sends no invitation notification", async () => {
    const server = createTestServer();
    const response = await server.request("POST", "/conversations", { name: "Notes", createdBy: creatorId });
    assert.equal(response.status, 201);
    assert.equal(server.notifications.length, 0);
    assert.equal(server.pushes.length, 0);
});

test("creator exclusion also works with the userId alias and uppercase UUIDs", async () => {
    const server = createTestServer();
    const response = await server.request("POST", "/conversations", {
        name: "New chat", userId: creatorId.toUpperCase(), userIds: [inviteeId],
    });
    assert.equal(response.status, 201);
    assert.deepEqual(server.notifications.map((notification) => notification.userId), [inviteeId]);
});

test("invalid or failed chat creation sends no invitation notifications", async () => {
    for (const failCreation of [false, true]) {
        const server = createTestServer({ failCreation });
        const response = await server.request("POST", "/conversations", {
            name: failCreation ? "New chat" : " ", createdBy: creatorId, memberIds: [inviteeId],
        });
        assert.equal(response.status, failCreation ? 500 : 400);
        assert.equal(server.notifications.length, 0);
        assert.equal(server.events.length, 0);
        assert.equal(server.pushes.length, 0);
    }
});

test("message mentions still use the existing notification and push payload", async () => {
    const server = createTestServer({ subscriptions: [{ userId: inviteeId, token: "device-token" }] });
    const response = await server.request("POST", "/conversations/public/messages", {
        sender: "Alice", text: "Hello!", userId: creatorId, profilePictureIndex: 2, pingedUserIds: [inviteeId],
    });
    assert.equal(response.status, 201);
    const notification = server.notifications[0];
    assert.equal(notification.type, "message");
    assert.equal(notification.title, "Alice");
    assert.equal(notification.body, "Hello!");
    assert.equal(notification.data.messageId, response.body.message.id);
    assert.equal(notification.data.profilePictureIndex, 2);
    assert.deepEqual(Array.from(notification.data.pingedUserIds), [inviteeId]);
    assert.deepEqual(JSON.parse(JSON.stringify(server.pushes[0])), {
        tokens: ["device-token"],
        notification: { title: "Alice", body: "Hello!" },
        data: {
            title: "Alice", body: "Hello!", conversationId: "public", messageId: response.body.message.id, profilePictureUrl: "",
        },
    });
});
