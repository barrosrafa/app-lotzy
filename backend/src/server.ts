import { createApp } from "./app.js";
import { env } from "./shared/config/env.js";
const server = createApp().listen(env.PORT, () =>
  console.log(`Lotzy API listening on http://localhost:${env.PORT}`),
);
server.on("error", (error: NodeJS.ErrnoException) => {
  console.error("Failed to bind the HTTP server", {
    code: error.code,
    message: error.message,
  });
  process.exit(1);
});
const shutdown = () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
};
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection", reason);
  process.exit(1);
});
process.on("uncaughtException", (error) => {
  console.error("Uncaught exception", error);
  process.exit(1);
});
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
