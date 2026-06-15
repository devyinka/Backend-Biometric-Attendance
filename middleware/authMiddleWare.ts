import { Request, Response, NextFunction } from "express";
import { Database } from "../config/database/connectdatabase";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

// Middleware to verify JWT token and authenticate user
export const requireAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized: Missing or invalid token" });
      return;
    }

    const token = authHeader.split(" ")[1];
    const { data, error } = await Database.auth.getUser(token);

    if (error || !data.user) {
      res
        .status(401)
        .json({ error: "Unauthorized: Token is expired or invalid" });
      return;
    }
    req.user = {
      id: data.user.id,
      email: data.user.email || "",
      role: data.user.user_metadata.role || "student",
    };

    next();
  } catch (err) {
    res
      .status(500)
      .json({ error: "Internal server error during authentication" });
  }
};

// Middleware to restrict access to lecturers only
export const requireLecturer = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized: Please log in first" });
    return;
  }
  if (req.user.role !== "lecturer") {
    res
      .status(403)
      .json({ error: "Forbidden: Only lecturers can access this endpoint" });
    return;
  }
  next();
};
