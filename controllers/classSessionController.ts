import { AuthenticatedRequest } from "../middleware/authMiddleWare";
import { Response } from "express";
import { SessionService } from "../services/classSessionService";

export const startSession = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: "Unauthorized: Please log in first" });
    return;
  }
  if (user.role !== "lecturer") {
    res
      .status(403)
      .json({ error: "Unauthorized: Only lecturers can start class sessions" });
    return;
  }

  const { courseId } = req.body;
  try {
    const session = await SessionService.startSession(courseId);
    res
      .status(200)
      .json({ message: "Class session started successfully", session });
  } catch (error: any) {
    if (error.message === "ALREADY_ACTIVE") {
      res
        .status(400)
        .json({ error: "A class session is already active for this course." });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
};

// intercept class session retrieval request by lecturer
export const getActiveSession = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: "Unauthorized: Please log in first" });
    return;
  }
  if (user.role !== "lecturer") {
    res.status(403).json({
      error: "Unauthorized: Only lecturers can view active class sessions",
    });
    return;
  }

  const { courseId } = req.params;
  try {
    const session = await SessionService.getActiveSession(courseId as string);
    if (!session) {
      res
        .status(404)
        .json({ error: "No active class session found for this course." });
      return;
    }
    res.status(200).json({
      message: "Active class session retrieved successfully",
      session,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// use session id get from get session to terminate the session and send command to ESP32 to terminate the session
export const endSession = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: "Unauthorized: Please log in first" });
    return;
  }
  if (user.role !== "lecturer") {
    res
      .status(403)
      .json({ error: "Unauthorized: Only lecturers can end class sessions" });
    return;
  }

  const { sessionId, course_code } = req.body;

  try {
    const session = await SessionService.endSession(sessionId, course_code);
    res
      .status(200)
      .json({ message: "Class session ended successfully", session });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
