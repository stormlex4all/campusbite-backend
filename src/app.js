"use strict";

const fs = require("fs");
const path = require("path");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const Config = require("./config");
const Database = require("./core/Database");
const requestLogger = require("./middleware/requestLogger");
const { notFound, errorHandler } = require("./middleware/errorHandler");
const buildApiRouter = require("./routes");

/**
 * Application factory: builds the Express app without starting a server or opening a database
 * connection, which keeps it easy to test with Supertest.
 */
function createApp() {
	const config = Config.get();
	const app = express();

	app.disable("x-powered-by");
	if (config.isProduction) app.set("trust proxy", 1);

	app.use(helmet());
	app.use(
		cors({
			// Native apps send no Origin header and are always allowed; browsers must be on the allow-list.
			origin(origin, callback) {
				if (!origin || config.cors.origins.includes(origin))
					return callback(null, true);
				return callback(null, false);
			},
			methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
			allowedHeaders: ["Content-Type", "Authorization"],
			maxAge: 600,
		}),
	);
	// Uploaded menu photos. Random file names, images only, long cache; allowed to load from the web app's origin.
	app.use(
		config.uploads.publicPath,
		express.static(config.uploads.dir, {
			index: false,
			dotfiles: "deny",
			fallthrough: false,
			maxAge: "7d",
			immutable: true,
			setHeaders: (res) =>
				res.set("Cross-Origin-Resource-Policy", "cross-origin"),
		}),
	);
	app.use(express.json({ limit: "100kb" }));
	app.use(requestLogger);

	app.get("/api/health", async (req, res) => {
		const db = Database.getInstance();
		const dbUp = await db.ping();
		res.status(dbUp ? 200 : 503).json({
			success: dbUp,
			data: {
				status: dbUp ? "ok" : "degraded",
				database: dbUp ? "up" : "down",
				uptimeSeconds: Math.round(process.uptime()),
			},
		});
	});

	app.use("/api", buildApiRouter());
	app.use("/api", notFound); // unknown /api routes get a JSON 404

	// Optionally serve the production build of the React web app from the same server
	const buildDir = config.client.buildDir;
	if (buildDir && fs.existsSync(path.join(buildDir, "index.html"))) {
		app.use(express.static(buildDir));
		app.get("*", (req, res) =>
			res.sendFile(path.join(buildDir, "index.html")),
		);
	} else {
		app.use(notFound);
	}

	app.use(errorHandler);
	return app;
}

module.exports = createApp;
