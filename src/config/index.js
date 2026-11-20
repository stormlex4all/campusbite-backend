"use strict";

const path = require("path");
const { z } = require("zod");

const DEV_ACCESS_SECRET = "dev-only-access-secret-change-me";

const envSchema = z.object({
	NODE_ENV: z
		.enum(["development", "test", "production"])
		.default("development"),
	PORT: z.coerce.number().int().min(0).max(65535).default(4000),
	MONGODB_URI: z
		.string()
		.min(1)
		.default("mongodb://127.0.0.1:27017/campusbite"),
	USE_TRANSACTIONS: z.enum(["auto", "true", "false"]).default("auto"),

	JWT_ACCESS_SECRET: z
		.string()
		.min(16, "JWT_ACCESS_SECRET must be at least 16 characters")
		.default(DEV_ACCESS_SECRET),
	JWT_ACCESS_TTL: z.string().default("15m"),
	REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
	BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(10),
	AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(20),
	SCHOOL_EMAIL_DOMAINS: z.string().default("rdpolytech.ca"),

	CORS_ORIGINS: z
		.string()
		.default(
			"http://localhost:5173,http://localhost:3000,http://localhost:8081",
		),
	CLIENT_BUILD_DIR: z.string().optional(),

	UPLOAD_DIR: z.string().default("./uploads"),
	MAX_IMAGE_MB: z.coerce.number().min(0.1).max(10).default(2),
	MAX_IMAGES_PER_ITEM: z.coerce.number().int().min(1).max(10).default(4),

	LOG_LEVEL: z
		.enum(["debug", "info", "warn", "error", "silent"])
		.default("info"),
});

const csv = (value) =>
	String(value)
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);

function deepFreeze(obj) {
	Object.values(obj).forEach((value) => {
		if (value && typeof value === "object" && !Object.isFrozen(value))
			deepFreeze(value);
	});
	return Object.freeze(obj);
}

/**
 * Config (Singleton)
 * ------------------
 * Reads and validates environment variables exactly once and exposes an immutable,
 * structured settings object. Every module calls `Config.get()` and always receives
 * the same instance. `Config.reset()` exists for tests only.
 */
class Config {
	static #instance = null;

	/** @returns {Config} the single shared instance */
	static getInstance(env = process.env) {
		if (!Config.#instance) Config.#instance = new Config(env);
		return Config.#instance;
	}

	/** Short alias for getInstance() */
	static get() {
		return Config.getInstance();
	}

	/** Test helper: forget the cached instance so the next call re-reads the environment. */
	static reset() {
		Config.#instance = null;
	}

	constructor(env = process.env) {
		const cleaned = Object.fromEntries(
			Object.entries(env).filter(
				([, value]) => value !== undefined && value !== "",
			),
		);
		const parsed = envSchema.safeParse(cleaned);
		if (!parsed.success) {
			const problems = parsed.error.issues
				.map((i) => `${i.path.join(".")}: ${i.message}`)
				.join("; ");
			throw new Error(`Invalid environment configuration: ${problems}`);
		}
		const v = parsed.data;

		if (
			v.NODE_ENV === "production" &&
			v.JWT_ACCESS_SECRET === DEV_ACCESS_SECRET
		) {
			throw new Error(
				"JWT_ACCESS_SECRET must be set to a private value in production.",
			);
		}

		this.env = v.NODE_ENV;
		this.isProduction = v.NODE_ENV === "production";
		this.isTest = v.NODE_ENV === "test";

		this.server = { port: v.PORT };
		this.db = { uri: v.MONGODB_URI, useTransactions: v.USE_TRANSACTIONS };
		this.auth = {
			accessSecret: v.JWT_ACCESS_SECRET,
			accessTtl: v.JWT_ACCESS_TTL,
			refreshTtlDays: v.REFRESH_TOKEN_TTL_DAYS,
			bcryptRounds: v.BCRYPT_ROUNDS,
			rateLimitMax: v.AUTH_RATE_LIMIT_MAX,
			schoolEmailDomains: csv(v.SCHOOL_EMAIL_DOMAINS).map((d) =>
				d.toLowerCase().replace(/^@/, ""),
			),
			issuer: "campusbite-api",
		};
		this.cors = { origins: csv(v.CORS_ORIGINS) };
		this.client = {
			buildDir: v.CLIENT_BUILD_DIR
				? path.resolve(v.CLIENT_BUILD_DIR)
				: null,
		};
		this.uploads = {
			driver: "local",
			dir: path.resolve(v.UPLOAD_DIR),
			publicPath: "/uploads", // images are served from <api origin>/uploads/<key>
			maxBytes: Math.round(v.MAX_IMAGE_MB * 1024 * 1024),
			maxImagesPerItem: v.MAX_IMAGES_PER_ITEM,
			allowedTypes: ["image/jpeg", "image/png", "image/webp"],
		};
		this.logging = { level: v.LOG_LEVEL };

		deepFreeze(this);
	}
}

module.exports = Config;
