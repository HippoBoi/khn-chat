const http = require("http");
const { Server } = require("socket.io");

const port = process.env.PORT || 3001;
const clientUrl = process.env.CLIENT_URL || "*";

const server = http.createServer((req, res) => {
    if (req.url === "/" || req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok" }));
        return;
    }

    res.writeHead(404);
    res.end();
});

const io = new Server(server, {
    cors: { origin: clientUrl }
});

io.on("connection", (socket) => {
    socket.on("message", (msg) => {
        io.emit("message", msg);
    });
});

server.listen(port, () => {
    console.log("running on port " + port);
});
