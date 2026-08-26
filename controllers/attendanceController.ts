import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/authMiddleWare";
import { Attendance } from "../services/attendanceService";

export const markLiveAttendance = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { fingerPrintSlot, courseId } = req.body;
    const face = req.file?.buffer;

    console.log("Received request to mark live attendance:", {
      fingerPrintSlot,
      courseId,
      face: face ? "Face data received" : "No face data",
    });

    const fingerprintSlotInt = parseInt(fingerPrintSlot, 10);

    if (isNaN(fingerprintSlotInt) || !courseId || !face) {
      res.status(400).json({ error: "Missing required data" });
      return;
    }

    const result = await Attendance.markLiveAttendance(
      face,
      fingerprintSlotInt,
      courseId,
    );

    res.status(200).json(result);
  } catch (error: any) {
    console.error("Error marking live attendance:", error);

    // Map known errors to appropriate HTTP status codes
    const errorMap: Record<string, number> = {
      UNREGISTERED_FINGERPRINT: 400,
      NO_ACTIVE_SESSION: 404,
      FACE_MISMATCH_REJECTED: 400,
      // Add more as needed
    };
    const status = errorMap[error.message] || 500;
    const message = error.message || "Failed to mark live attendance";

    res.status(status).json({ error: message });
  }
};

export const markOfflineAttendance = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { scans, courseId } = req.body;

    console.log("Received request to mark offline attendance:", {
      scans,
      courseId,
    });
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

export const getAttendanceBlockchainRecord = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const User = req.user;
  if (!User) {
    res.status(401).json({ error: "Unauthorized: Please log in first" });
    return;
  }

  const { studentId, sessionId } = req.query as {
    studentId?: string;
    sessionId?: string;
  };

  if (!studentId || !sessionId) {
    res.status(400).json({
      error: "Missing required query parameters: studentId and sessionId",
    });
    return;
  }

  try {
    const Result = await Attendance.getAttendanceBlockchainRecord(
      studentId,
      sessionId,
    );
    res.status(200).json({
      status: "success",
      data: Result,
    });
  } catch (error: any) {
    console.error("Blockchain Record Fetch Error:", error);

    if (error.message === "ATTENDANCE_RECORD_NOT_FOUND_ON_CHAIN") {
      res.status(404).json({
        status: "failed",
        error: "Attendance record not found on Solana blockchain",
      });
      return;
    }

    res.status(500).json({
      status: "failed",
      error:
        error.message || "Internal server error fetching blockchain record",
    });
  }
};

export const getSemesterReport = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const User = req.user;
  if (!User) {
    res.status(401).json({ error: "Unauthorized: Please log in first" });
    return;
  }
  if (User.role !== "lecturer") {
    res.status(403).json({
      error: "Forbidden: you must be a lecturer to get Semester Report",
    });
    return;
  }
  try {
    const { courseId } = req.params;
    if (!courseId) {
      res.status(400).json({
        error: "Missing required parameter: courseId",
      });
      return;
    }
    const Result = await Attendance.getsemesterReport(courseId as string);
    res.status(200).json({
      status: "success",
      data: Result,
    });
  } catch (error: any) {
    console.error("Semester Report Fetch Error:", error);

    if (error.message === "UNAUTHORIZED_USER") {
      res.status(403).json({
        status: "failed",
        error: "Access denied. Invalid user identification.",
      });
      return;
    }
    res.status(500).json({
      status: "failed",
      error: error.message || "Internal server error fetching semester report",
    });
  }
};
