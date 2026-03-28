import type { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcrypt";
import { storage } from "./storage";
import connectPgSimple from "connect-pg-simple";

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(supplied: string, stored: string): Promise<boolean> {
  return bcrypt.compare(supplied, stored);
}

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === "production" && !secret) {
    throw new Error("SESSION_SECRET is required in production. Set it in your environment.");
  }
  return secret || "socialflow-dev-secret";
}

export function setupAuth(app: Express) {
  // Trust Railway's TLS-terminating reverse proxy so that Express sees
  // requests as HTTPS and sets the secure session cookie correctly.
  app.set("trust proxy", 1);

  // Use PostgreSQL session store in production when DATABASE_URL is available
  const PgSession = connectPgSimple(session);
  const sessionStore =
    process.env.NODE_ENV === "production" && process.env.DATABASE_URL
      ? new PgSession({
          conString: process.env.DATABASE_URL,
          tableName: "session",
          createTableIfMissing: true,
        })
      : undefined;

  app.use(
    session({
      store: sessionStore,
      secret: getSessionSecret(),
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    }),
  );

  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy({ usernameField: "email" }, async (email, password, done) => {
      try {
        const user = await storage.getUserByEmail(email);
        if (!user) {
          return done(null, false, { message: "Invalid email or password" });
        }

        const isValid = await comparePassword(password, user.password);
        if (!isValid) {
          return done(null, false, { message: "Invalid email or password" });
        }

        const { password: _password, ...safeUser } = user;
        return done(null, safeUser as any);
      } catch (error) {
        return done(error as any);
      }
    }),
  );

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        return done(null, false);
      }

      const { password: _password, ...safeUser } = user;
      done(null, safeUser as any);
    } catch (error) {
      done(error as any);
    }
  });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }

  return res.status(401).json({ error: "Unauthorized" });
}

