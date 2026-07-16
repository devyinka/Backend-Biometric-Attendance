import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/authMiddleWare";
import { AdminService } from "../services/admin";
import { mqttClient } from "../config/MQTT/mqtt";

export const getAllStudents = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  const User = req.user;
  if (!User) {
    return res.status(401).json({ error: "Unauthorized: Please log in first" });
  }
  if (User.role !== "admin") {
    return res
      .status(403)
      .json({ error: "Unauthorize: Only admins can view students" });
  }
  try {
    const students = await AdminService.getAllStudents();
    res.status(200).json(students);
    console.log("students response", students);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const enrollStudent = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  const User = req.user;
  if (!User) {
    return res.status(401).json({ error: "Unauthorized: Please log in first" });
  }
  if (User.role !== "admin") {
    return res
      .status(403)
      .json({ error: "Unauthorize: Only admins can enroll students" });
  }
  try {
    const { matricNumber, studentId } = req.body;
    if (!matricNumber) {
      return res.status(400).json({ error: "Matric number is required" });
    }
    if (!studentId) {
      return res.status(400).json({ error: "Student ID is required" });
    }
    // Publish the matric number to the MQTT topic for enrollment
    mqttClient.publish(
      "enrollment",
      JSON.stringify({
        command: "enroll",
        matricNumber: matricNumber,
        studentId: studentId,
      }),
      (err) => {
        if (err) {
          console.error("Failed to trigger enrollment:", err);
          return res.status(500).json({ error: "Failed to enroll student" });
        }
        console.log("Enrollment message published successfully");
        res.status(200).json({
          message: "kiosk is now in registration mode for " + matricNumber,
        });
      },
    );
  } catch (error: any) {
    console.error("Error during enrollment:", error);
    res.status(500).json({ error: "fail to trigger kiosk for enrollment" });
  }
};

export const createCourse = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  const User = req.user;

  if (!User) {
    return res.status(401).json({ error: "Unauthorized: Please log in first" });
  }
  if (User.role !== "admin") {
    return res
      .status(403)
      .json({ error: "Unauthorized: Only admins can create courses" });
  }

  try {
    const { course_code, title, level, credits, semester, lecturerId } =
      req.body;

    const cleanCourseCode = course_code.replace(/\s+/g, "").toUpperCase();
    const levelNumber = parseInt(level, 10);
    const newCourse = await AdminService.createCourse({
      course_code: cleanCourseCode,
      title: title,
      level: levelNumber,
      credits: credits,
    });
    let assignmentRecord = null;
    let assignmentWarning = null;

    if (lecturerId && lecturerId !== "unassigned") {
      try {
        assignmentRecord = await AdminService.assignLecturerToCourse(
          newCourse.id,
          lecturerId,
        );
      } catch (assignmentError) {
        assignmentWarning =
          "Course was created, but failed to assign the lecturer.";
      }
    }
    res.status(200).json({
      message: "Course created successfully",
      data: {
        course: newCourse,
        assignment: assignmentRecord,
      },
      warning: assignmentWarning,
    });
  } catch (error: any) {
    console.error("Error creating course:", error);

    if (error.message.includes("courses_course_code_key")) {
      return res
        .status(400)
        .json({ error: "This Course Code already exists in the database." });
    }
    if (error.message.includes("courses_course_code_check")) {
      return res.status(400).json({
        error:
          "Course code must be exactly 3 letters followed by 3 numbers (e.g., CPE121).",
      });
    }

    res.status(500).json({ error: "Failed to create course" });
  }
};

export const getAllLecturers = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  const User = req.user;

  if (!User) {
    return res.status(401).json({ error: "Unauthorized: Please log in first" });
  }
  if (User.role !== "admin") {
    return res
      .status(403)
      .json({ error: "Unauthorized: Only admins can view lecturers" });
  }

  try {
    const lecturers = await AdminService.getAllLecturers();
    res.status(200).json(lecturers);
  } catch (error: any) {
    console.error("Error fetching lecturers:", error);
    res.status(500).json({ error: "Failed to fetch lecturers" });
  }
};

export const getAllCourses = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  const User = req.user;
  if (!User) {
    return res.status(401).json({ error: "Unauthorized: Please log in first" });
  }
  if (User.role !== "admin") {
    return res
      .status(403)
      .json({
        error:
          "Unauthorized: Only admins can view all the courses in the database",
      });
  }

  try {
    const courses = await AdminService.getAllCourses();
    res.status(200).json(courses);

    console.log(`Successfully fetched ${courses.length} courses for dashboard`);
  } catch (error: any) {
    console.error("Error fetching courses:", error);
    res.status(500).json({ error: error.message || "Failed to fetch courses" });
  }
};
