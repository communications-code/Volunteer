import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import cookieSession from "cookie-session";
import { scrypt, randomBytes, timingSafeEqual, createHash, createHmac } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import {
  User as SelectUser,
  adminMagicLoginTokens,
  authEvents,
  users,
} from "@shared/schema";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { sendEmail } from "./email";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const MAGIC_LINK_TTL_MINUTES = 15;
const AUTH_TOKEN_TTL_HOURS = 24;
const AUTH_EMAIL_FROM = process.env.DEFAULT_FROM_EMAIL?.trim() || "communications@vfwharrisonoh.org";
const GENERIC_MAGIC_LINK_RESPONSE =
  "If an admin account exists for that email, a sign-in link has been sent.";

const magicLinkRequestSchema = z.object({
  username: z.string().trim().email().max(320),
});

const magicLinkVerifySchema = z.object({
  token: z.string().trim().min(20).max(512),
});

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

function getClientIp(req: any): string | null {
  const forwardedFor = req.headers?.["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.length > 0) {
    return forwardedFor.split(",")[0].trim();
  }
  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    return String(forwardedFor[0]).trim();
  }
  return req.ip || null;
}

function getUserAgent(req: any): string | null {
  const ua = req.headers?.["user-agent"];
  return typeof ua === "string" ? ua : null;
}

function getHostUrl(): string {
  return (
    process.env.HOST_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://apps.vfwharrisonoh.org")
  );
}

async function logAuthEvent(params: {
  userId?: number | null;
  usernameAttempt?: string | null;
  eventType: string;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  try {
    await db.insert(authEvents).values({
      userId: params.userId ?? null,
      usernameAttempt: params.usernameAttempt ?? null,
      eventType: params.eventType,
      ip: params.ip ?? null,
      userAgent: params.userAgent ?? null,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    });
  } catch (error) {
    console.error("Failed to write auth event:", error);
  }
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  // Handle plain text passwords for legacy users or manual seeds.
  // Only treat as hash if it matches our "hex.hex" scrypt storage format.
  const parts = stored.split(".");
  const looksHashed =
    parts.length === 2 &&
    /^[0-9a-f]{128}$/i.test(parts[0]) &&
    /^[0-9a-f]{32}$/i.test(parts[1]);

  if (!looksHashed) {
    return supplied === stored;
  }

  const [hashed, salt] = parts;
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

function hashMagicToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function getTokenSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret) {
    throw new Error("SESSION_SECRET environment variable must be set");
  }
  return secret;
}

function createAuthToken(userId: number): string {
  const payload = {
    userId,
    exp: Date.now() + AUTH_TOKEN_TTL_HOURS * 60 * 60 * 1000,
    v: 1,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", getTokenSecret())
    .update(encodedPayload)
    .digest("base64url");
  return `${encodedPayload}.${signature}`;
}

function verifyAuthToken(token: string): { userId: number } | null {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const expectedSignature = createHmac("sha256", getTokenSecret())
    .update(encodedPayload)
    .digest("base64url");

  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(provided, expected)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as {
      userId?: unknown;
      exp?: unknown;
    };
    if (typeof parsed.userId !== "number" || typeof parsed.exp !== "number") return null;
    if (parsed.exp <= Date.now()) return null;
    return { userId: parsed.userId };
  } catch {
    return null;
  }
}

function buildAuthResponse(user: SelectUser) {
  const { password, ...safeUser } = user;
  const authToken = createAuthToken(user.id);
  return { ...safeUser, authToken };
}

export function setupAuth(app: Express) {
  const sessionSecret = getTokenSecret();
  const isProduction = process.env.NODE_ENV === "production";

  app.set("trust proxy", 1);

  const sessionOptions: any = {
    name: "clh_session",
    keys: [sessionSecret],
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: isProduction,
    sameSite: isProduction ? ("none" as const) : ("lax" as const), // "none" required for iframe cross-origin cookies
    httpOnly: true,
  };

  // Improve reliability for embedded (iframe) usage in modern browsers that
  // partition third-party cookies. Unsupported browsers ignore this attribute.
  if (isProduction) {
    sessionOptions.partitioned = true;
  }

  // Cookie-based sessions — no DB round-trip required.
  // Session data is tiny (just passport user ID), so a signed cookie is ideal
  // for serverless where DB-backed sessions cause cold-start bottlenecks.
  app.use(cookieSession(sessionOptions));

  const ensurePassportSessionCompat = (req: any) => {
    if (!req.session) return;

    // Define as non-enumerable so cookie-session does not treat these helpers
    // as persisted session fields and overwrite cookies on read-only requests.
    if (typeof req.session.regenerate !== "function") {
      Object.defineProperty(req.session, "regenerate", {
        value: (cb: (err?: any) => void) => cb(),
        enumerable: false,
        configurable: true,
      });
    }
    if (typeof req.session.save !== "function") {
      Object.defineProperty(req.session, "save", {
        value: (cb: (err?: any) => void) => cb(),
        enumerable: false,
        configurable: true,
      });
    }
  };

  // Passport requires req.session.regenerate and req.session.save for req.login
  // and req.logout. Apply this only on auth mutation routes to avoid touching
  // session objects on normal read requests (which can clear cookies in iframes).
  app.use((req: any, _res, next) => {
    if (
      req.path === "/api/login" ||
      req.path === "/api/register" ||
      req.path === "/api/logout" ||
      req.path === "/api/admin/auth/magic-link/verify"
    ) {
      ensurePassportSessionCompat(req);
    }
    next();
  });

  app.use(passport.initialize());
  app.use(passport.session());

  // Fallback auth for environments where cookies are unreliable
  // (e.g. iframe contexts or strict browser cookie policies).
  app.use(async (req: any, _res, next) => {
    if (req.user) return next();
    const authHeader = req.headers?.authorization;
    if (typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
      return next();
    }
    const token = authHeader.slice("Bearer ".length).trim();
    const payload = verifyAuthToken(token);
    if (!payload) return next();
    try {
      const user = await storage.getUser(payload.userId);
      if (user) {
        req.user = user;
      }
    } catch (error) {
      console.error("Bearer auth user lookup failed:", error);
    }
    return next();
  });

  passport.use(
    new LocalStrategy(
      { usernameField: "username", passwordField: "password", passReqToCallback: true },
      async (req: any, username, password, done) => {
        const normalizedUsername = normalizeUsername(username);
        const ip = getClientIp(req);
        const userAgent = getUserAgent(req);

        try {
          const candidateUsers = await storage.getUsersByCanonicalUsername(normalizedUsername);
          const user = candidateUsers[0];

          if (!user) {
            await logAuthEvent({
              usernameAttempt: normalizedUsername,
              eventType: "LOGIN_FAIL",
              ip,
              userAgent,
              metadata: { reason: "USER_NOT_FOUND" },
            });
            return done(null, false, { message: "Invalid credentials" });
          }

          const nowMs = Date.now();
          let matchedUser: SelectUser | null = null;
          let matchedLockedUser: SelectUser | null = null;

          for (const candidate of candidateUsers) {
            const matches = await comparePasswords(password, candidate.password);
            if (!matches) continue;
            const isCandidateLocked =
              candidate.lockedUntil instanceof Date && candidate.lockedUntil.getTime() > nowMs;
            if (isCandidateLocked) {
              matchedLockedUser = candidate;
              continue;
            }
            matchedUser = candidate;
            break;
          }

          if (!matchedUser && matchedLockedUser) {
            await logAuthEvent({
              userId: matchedLockedUser.id,
              usernameAttempt: normalizedUsername,
              eventType: "LOCKOUT",
              ip,
              userAgent,
              metadata: {
                lockedUntil: matchedLockedUser.lockedUntil?.toISOString() ?? null,
                candidateCount: candidateUsers.length,
              },
            });
            return done(null, false, {
              message:
                "Your account is temporarily locked due to repeated failed logins. Try again in 15 minutes or use magic link sign-in.",
            });
          }

          if (!matchedUser) {
            const targetUser =
              candidateUsers.find(
                (candidate) =>
                  !(candidate.lockedUntil instanceof Date) ||
                  candidate.lockedUntil.getTime() <= nowMs,
              ) || user;

            const nextAttempts = (targetUser.failedLoginAttempts ?? 0) + 1;
            const shouldLock = nextAttempts >= MAX_FAILED_ATTEMPTS;
            const lockedUntil = shouldLock
              ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
              : null;

            await db
              .update(users)
              .set({
                failedLoginAttempts: nextAttempts,
                lockedUntil,
              })
              .where(eq(users.id, targetUser.id));

            await logAuthEvent({
              userId: targetUser.id,
              usernameAttempt: normalizedUsername,
              eventType: shouldLock ? "LOCKOUT" : "LOGIN_FAIL",
              ip,
              userAgent,
              metadata: {
                reason: "PASSWORD_MISMATCH",
                failedAttempts: nextAttempts,
                lockedUntil: lockedUntil?.toISOString() ?? null,
                candidateCount: candidateUsers.length,
              },
            });

            return done(null, false, {
              message: shouldLock
                ? "Too many failed logins. Account locked for 15 minutes. You can use a magic sign-in link now."
                : "Password login failed. Try magic link or contact an admin for reset.",
            });
          }

          await db
            .update(users)
            .set({
              failedLoginAttempts: 0,
              lockedUntil: null,
              lastLoginAt: new Date(),
            })
            .where(eq(users.id, matchedUser.id));

          await logAuthEvent({
            userId: matchedUser.id,
            usernameAttempt: normalizedUsername,
            eventType: "LOGIN_SUCCESS",
            ip,
            userAgent,
            metadata: {
              candidateCount: candidateUsers.length,
              matchedUserId: matchedUser.id,
            },
          });

          return done(null, matchedUser);
        } catch (error) {
          console.error("Authentication error:", error);
          return done(error);
        }
      },
    ),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const normalizedUsername =
        typeof req.body?.username === "string" ? req.body.username.trim().toLowerCase() : req.body?.username;
      req.body.username = normalizedUsername;

      // Only allow admins to create other admin accounts
      if (req.body.isAdmin && (!req.user || !req.user.isAdmin)) {
        return res.status(403).json({ message: "Only admins can create admin accounts" });
      }

      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const user = await storage.createUser({
        ...req.body,
        password: await hashPassword(req.body.password),
      });

      ensurePassportSessionCompat(req);
      req.login(user, (err) => {
        if (err) return next(err);
        res.set("Cache-Control", "private, no-store");
        res.status(201).json(buildAuthResponse(user));
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/login", (req, res, next) => {
    if (typeof req.body?.username === "string") {
      req.body.username = normalizeUsername(req.body.username);
    }
    passport.authenticate("local", (err: any, user: Express.User | false, info: any) => {
      if (err) return next(err);
      if (!user) {
        res.set("Cache-Control", "private, no-store");
        return res.status(401).json({
          message:
            info?.message ||
            "Password login failed. Try magic link or contact an admin for reset.",
        });
      }
      ensurePassportSessionCompat(req);
      req.login(user, (err) => {
        if (err) return next(err);
        res.set("Cache-Control", "private, no-store");
        res.json(buildAuthResponse(user));
      });
    })(req, res, next);
  });

  app.post("/api/admin/auth/magic-link/request", async (req, res) => {
    const parsed = magicLinkRequestSchema.safeParse(req.body);
    const ip = getClientIp(req);
    const userAgent = getUserAgent(req);
    const genericResponse = { message: GENERIC_MAGIC_LINK_RESPONSE };

    if (!parsed.success) {
      res.set("Cache-Control", "private, no-store");
      return res.status(200).json(genericResponse);
    }

    const normalizedUsername = normalizeUsername(parsed.data.username);

    try {
      const user = await storage.getUserByUsername(normalizedUsername);
      if (!user || !user.isAdmin) {
        await logAuthEvent({
          usernameAttempt: normalizedUsername,
          eventType: "MAGIC_LINK_SENT",
          ip,
          userAgent,
          metadata: { delivered: false, reason: "USER_NOT_FOUND_OR_NOT_ADMIN" },
        });
        res.set("Cache-Control", "private, no-store");
        return res.status(200).json(genericResponse);
      }

      const issuedAt = new Date();
      const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MINUTES * 60 * 1000);
      const rawToken = randomBytes(32).toString("base64url");
      const tokenHash = hashMagicToken(rawToken);

      await db.transaction(async (tx) => {
        await tx
          .update(adminMagicLoginTokens)
          .set({ usedAt: issuedAt })
          .where(
            and(
              eq(adminMagicLoginTokens.userId, user.id),
              isNull(adminMagicLoginTokens.usedAt),
              gt(adminMagicLoginTokens.expiresAt, issuedAt),
            ),
          );

        await tx.insert(adminMagicLoginTokens).values({
          userId: user.id,
          tokenHash,
          expiresAt,
          createdIp: ip,
          createdUserAgent: userAgent,
        });
      });

      const signInUrl = `${getHostUrl()}/auth?magic=${encodeURIComponent(rawToken)}`;
      const delivered = await sendEmail({
        to: user.username,
        from: AUTH_EMAIL_FROM,
        subject: "Your VFW Post 7570 admin sign-in link",
        ignoreEmailDeliveryPause: true,
        text:
          `Use this secure one-time sign-in link:\n\n${signInUrl}\n\n` +
          `This link expires in ${MAGIC_LINK_TTL_MINUTES} minutes and can only be used once.`,
        html: `
          <p>Use this secure one-time sign-in link:</p>
          <p><a href="${signInUrl}">Sign in to Admin Dashboard</a></p>
          <p>This link expires in ${MAGIC_LINK_TTL_MINUTES} minutes and can only be used once.</p>
        `,
      });

      await logAuthEvent({
        userId: user.id,
        usernameAttempt: normalizedUsername,
        eventType: "MAGIC_LINK_SENT",
        ip,
        userAgent,
        metadata: {
          delivered,
          expiresAt: expiresAt.toISOString(),
        },
      });
    } catch (error) {
      console.error("Error creating magic link:", error);
      await logAuthEvent({
        usernameAttempt: normalizedUsername,
        eventType: "MAGIC_LINK_SENT",
        ip,
        userAgent,
        metadata: { delivered: false, reason: "SERVER_ERROR" },
      });
    }

    res.set("Cache-Control", "private, no-store");
    return res.status(200).json(genericResponse);
  });

  app.post("/api/admin/auth/magic-link/verify", async (req, res, next) => {
    const parsed = magicLinkVerifySchema.safeParse(req.body);
    if (!parsed.success) {
      res.set("Cache-Control", "private, no-store");
      return res.status(400).json({
        message: "This sign-in link is invalid or expired. Please request a new link.",
      });
    }

    const ip = getClientIp(req);
    const userAgent = getUserAgent(req);
    const tokenHash = hashMagicToken(parsed.data.token);
    const now = new Date();

    try {
      const tokenRows = await db
        .select()
        .from(adminMagicLoginTokens)
        .where(
          and(
            eq(adminMagicLoginTokens.tokenHash, tokenHash),
            isNull(adminMagicLoginTokens.usedAt),
            gt(adminMagicLoginTokens.expiresAt, now),
          ),
        )
        .orderBy(desc(adminMagicLoginTokens.createdAt))
        .limit(1);

      const tokenRow = tokenRows[0];
      if (!tokenRow) {
        await logAuthEvent({
          eventType: "LOGIN_FAIL",
          ip,
          userAgent,
          metadata: { reason: "MAGIC_LINK_INVALID_OR_EXPIRED" },
        });
        res.set("Cache-Control", "private, no-store");
        return res.status(400).json({
          message: "This sign-in link is invalid or expired. Please request a new link.",
        });
      }

      const consumed = await db
        .update(adminMagicLoginTokens)
        .set({ usedAt: now })
        .where(
          and(eq(adminMagicLoginTokens.id, tokenRow.id), isNull(adminMagicLoginTokens.usedAt)),
        )
        .returning({ id: adminMagicLoginTokens.id });

      if (consumed.length === 0) {
        res.set("Cache-Control", "private, no-store");
        return res.status(400).json({
          message: "This sign-in link has already been used. Please request a new link.",
        });
      }

      const user = await storage.getUser(tokenRow.userId);
      if (!user || !user.isAdmin) {
        await logAuthEvent({
          userId: tokenRow.userId,
          eventType: "LOGIN_FAIL",
          ip,
          userAgent,
          metadata: { reason: "MAGIC_LINK_USER_NOT_FOUND_OR_NOT_ADMIN" },
        });
        res.set("Cache-Control", "private, no-store");
        return res.status(400).json({
          message: "This sign-in link is invalid or expired. Please request a new link.",
        });
      }

      await db
        .update(users)
        .set({
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: now,
        })
        .where(eq(users.id, user.id));

      await logAuthEvent({
        userId: user.id,
        usernameAttempt: normalizeUsername(user.username),
        eventType: "MAGIC_LINK_USED",
        ip,
        userAgent,
        metadata: { tokenId: tokenRow.id },
      });

      ensurePassportSessionCompat(req);
      req.login(user, (err) => {
        if (err) return next(err);
        res.set("Cache-Control", "private, no-store");
        return res.json(buildAuthResponse(user));
      });
    } catch (error) {
      console.error("Error verifying magic link:", error);
      res.set("Cache-Control", "private, no-store");
      return res.status(500).json({
        message: "Unable to sign in with link right now. Please try again.",
      });
    }
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.set("Cache-Control", "private, no-store");
      res.status(200).json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      res.set("Cache-Control", "private, no-store");
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = req.user as SelectUser;
    const { password, ...safeUser } = user;
    res.set("Cache-Control", "private, no-store");
    res.json(safeUser);
  });
}
