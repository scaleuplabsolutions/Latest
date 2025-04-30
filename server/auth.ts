import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  try {
    const [hashed, salt] = stored.split(".");
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    console.error("Password comparison error:", error);
    return false;
  }
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || 'expirytracker-secret-key',
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
      secure: process.env.NODE_ENV === 'production'
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // For our plaintext password admin user, we can use a custom verify function
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        console.log("Attempting login for username:", username);
        const user = await storage.getUserByUsername(username);
        
        if (!user) {
          console.log("User not found");
          return done(null, false, { message: "Invalid username" });
        }
        
        // For the admin user, allow plaintext password login
        if (username === 'admin' && password === user.password) {
          console.log("Admin user authenticated with plaintext password");
          return done(null, user);
        }
        
        // For other users, check hashed password
        if (user.password.includes('.')) {
          // Assume it's a hashed password
          const passwordValid = await comparePasswords(password, user.password);
          if (!passwordValid) {
            console.log("Invalid password (hashed)");
            return done(null, false, { message: "Invalid password" });
          }
        } else {
          // Plaintext password comparison
          if (password !== user.password) {
            console.log("Invalid password (plaintext)");
            return done(null, false, { message: "Invalid password" });
          }
        }
        
        console.log("User authenticated successfully");
        return done(null, user);
      } catch (err) {
        console.error("Login error:", err);
        return done(err);
      }
    }),
  );

  passport.serializeUser((user, done) => {
    console.log("Serializing user:", user.id);
    done(null, user.id);
  });
  
  passport.deserializeUser(async (id: number, done) => {
    try {
      console.log("Deserializing user:", id);
      const user = await storage.getUser(id);
      if (!user) {
        console.log("User not found during deserialization");
        return done(null, false);
      }
      done(null, user);
    } catch (err) {
      console.error("Deserialize user error:", err);
      done(err, null);
    }
  });

  // Debug middleware to see session and user data
  app.use((req: Request, res: Response, next: NextFunction) => {
    console.log(`Auth Debug - Path: ${req.path}`);
    console.log(`Auth Debug - isAuthenticated: ${req.isAuthenticated()}`);
    console.log(`Auth Debug - Session: ${JSON.stringify(req.session)}`);
    console.log(`Auth Debug - User: ${JSON.stringify(req.user)}`);
    next();
  });

  app.post("/api/auth/register", async (req, res, next) => {
    try {
      const { username, password, systemType } = req.body;
      
      if (!username || !password || !systemType) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const user = await storage.createUser({
        username,
        password: await hashPassword(password),
        systemType
      });

      req.login(user, (err) => {
        if (err) return next(err);
        
        // Set session data
        if (req.session) {
          req.session.userId = user.id;
          req.session.username = user.username;
          req.session.systemType = user.systemType;
        }
        
        return res.status(201).json({ 
          id: user.id,
          username: user.username,
          systemType: user.systemType
        });
      });
    } catch (err) {
      console.error("Register error:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/login", (req, res, next) => {
    console.log("Login attempt for:", req.body.username);
    
    passport.authenticate("local", (err, user, info) => {
      if (err) {
        console.error("Login error:", err);
        return res.status(500).json({ message: "Internal server error" });
      }
      
      if (!user) {
        console.log("Authentication failed:", info?.message || "Unknown reason");
        return res.status(401).json({ message: info?.message || "Invalid username or password" });
      }
      
      req.login(user, (loginErr) => {
        if (loginErr) {
          console.error("Login session error:", loginErr);
          return next(loginErr);
        }
        
        // Also set req.session data for our systemType use
        if (req.session) {
          req.session.userId = user.id;
          req.session.username = user.username;
          req.session.systemType = req.body.systemType || user.systemType;
        }
        
        console.log("Login successful, returning user data");
        return res.status(200).json({ 
          id: user.id,
          username: user.username,
          systemType: req.body.systemType || user.systemType
        });
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res, next) => {
    console.log("Logout attempt");
    req.logout((err) => {
      if (err) {
        console.error("Logout error:", err);
        return next(err);
      }
      
      req.session?.destroy((err) => {
        if (err) {
          console.error("Session destroy error:", err);
          return next(err);
        }
        
        res.clearCookie('connect.sid');
        console.log("Logout successful");
        res.status(200).json({ message: "Logged out successfully" });
      });
    });
  });

  app.get("/api/auth/me", (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    res.json({
      id: req.user.id,
      username: req.user.username,
      systemType: req.session?.systemType || req.user.systemType
    });
  });
}