import { createServer } from "./server.js";

const server = createServer();

await server.listen({ host: "127.0.0.1", port: 3000 });
