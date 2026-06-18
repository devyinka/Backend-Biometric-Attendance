import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/authMiddleWare";
import { Attendance } from "../services/attendanceService";

export const markLiveAttendance = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { fingerprintSlot, courseId } = req.body;
    const liveImageBuffer = req.file?.buffer;

    const fingerprintSlotInt = parseInt(fingerprintSlot, 10); // Ensure fingerprintSlot is an integer

    if (isNaN(fingerprintSlotInt) || !courseId || !liveImageBuffer) {
      res.status(400).json({ error: "Missing required data" });
      return;
    }

    const result = await Attendance.markLiveAttendance(
      liveImageBuffer,
      fingerprintSlotInt,
      courseId,
    );

    res.status(200).json(result);
  } catch (error: any) {
    console.error("Error marking live attendance:", error);
    res.status(500).json({ error: "Failed to mark live attendance" });
  }
};

export const markOfflineAttendance = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { scans, courseId } = req.body;
    if (!courseId) {
      res.status(400).json({ error: "Missing courseId" });
      return;
    }
    if (!Array.isArray(scans) || scans.length === 0) {
      res.status(400).json({ error: "Scans must be a non-empty array" });
      return;
    }

    const result = await Attendance.markOfflineAttendance(scans, courseId);
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Error marking offline attendance:", error);
    res.status(500).json({ error: "Failed to mark offline attendance" });
  }
};

export const getAttendanceHistory = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const User = req.user;
  if (!User) {
    res.status(401).json({ error: "Unauthorized: Please log in first" });
    return;
  }
  if (User.role !== "lecturer" && User.role !== "student") {
    res.status(403).json({
      error:
        "Forbidden: you must be a student or lecturer to get Attendance history",
    });
    return;
  }
  try {
    const { courseId, month, year, userId, page = 1, limit = 50 } = req.body;
    if (!courseId || !month || !year || !userId) {
      res.status(400).json({
        error: "Missing required parameters: courseId, month, year, or userId",
      });
      return;
    }
    const Result = await Attendance.getAttendanceHistory(
      courseId,
      month,
      Number(year),
      userId,
      Number(page),
      Number(limit),
    );
    res.status(200).json({
      status: "success",
      data: Result.records,
      pagination: Result.pagination,
    });
  } catch (error: any) {
    console.error("Attendance Fetch Error:", error);

    if (error.message === "UNAUTHORIZED_USER") {
      res.status(403).json({
        status: "failed",
        error: "Access denied. Invalid user identification.",
      });
      return;
    }
    res.status(500).json({
      status: "failed",
      error: error.message || "Internal server error fetching logs",
    });
  }
};
