import { Response } from "express";
import { StudentService } from "../services/studentServices";
import { AuthenticatedRequest } from "../middleware/authMiddleWare";

export const getAvailableCourses = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const user = req.user;

  if (!user) {
    res.status(401).json({ error: "Unauthorized: Please log in first" });
    return;
  }

  if (user.role !== "student") {
    res.status(403).json({
      error: "Unauthorized: Only students can view the course catalog",
    });
    return;
  }

  try {
    console.log("Fetching available courses for student level:", user.level);
    const result = await StudentService.getAvailableCourses(Number(user.level));
    res.status(200).json({
      message: "Successfully fetched available courses",
      data: result.courses,
      studentLevel: result.studentLevel,
    });
  } catch (error: any) {
    console.error("Fetch Courses Error:", error);
    res
      .status(500)
      .json({ error: error.message || "Failed to fetch available courses" });
  }
};

export const registerCourses = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const user = req.user;

  if (!user) {
    res.status(401).json({ error: "Unauthorized: Please log in first" });
    return;
  }

  if (user.role !== "student") {
    res
      .status(403)
      .json({ error: "Unauthorized: Only students can register for courses" });
    return;
  }

  try {
    const { courseIds } = req.body;
    if (!courseIds || !Array.isArray(courseIds) || courseIds.length === 0) {
      res
        .status(400)
        .json({ error: "Please select at least one course to register." });
      return;
    }
    const result = await StudentService.registerCourses(user.id, courseIds);

    res.status(200).json({
      message: "Successfully registered for courses",
      data: result,
    });
  } catch (error: any) {
    console.error("Course Registration Error:", error);
    res
      .status(500)
      .json({ error: error.message || "Failed to register for courses" });
  }
};

export const getAttendanceRecordsOfRegisteredCourses = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const user = req.user;

  if (!user) {
    res.status(401).json({ error: "Unauthorized: Please log in first" });
    return;
  }

  if (user.role !== "student") {
    res.status(403).json({
      error:
        "Unauthorized: Only students can view attendance records of registered courses",
    });
    return;
  }

  try {
    const result = await StudentService.getAttendanceRecordsOfRegisteredCourses(
      user.id,
    );

    res.status(200).json({
      message: "Successfully fetched attendance records",
      data: result,
    });
  } catch (error: any) {
    console.error("Fetch Attendance Records Error:", error);
    res.status(500).json({
      error:
        error.message ||
        "Failed to fetch attendance records of registered courses",
    });
  }
};
