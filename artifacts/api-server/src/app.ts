import express from "express";
import pinoHttp from "pino-http";
import { logger } from "./lib/logger";
import router from "./routes/index";

const app = express();

app.use(pinoHttp({ logger }));
app.use(express.json());

const basePath = process.env.BASE_PATH ?? "/api";
app.use(basePath, router);

export default app;
