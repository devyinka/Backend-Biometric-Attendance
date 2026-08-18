import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/authMiddleWare";
import { AdminService } from "../services/admin";
import { mqttClient } from "../config/MQTT/mqtt";

export const getAdminDashboardStats = async (
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
      .json({ error: "Unauthorize: Only admins can view dashboard stats" });
  }
  try {
    const stats = await AdminService.getAdminDashboardStats();
    res.status(200).json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

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

// export const enrollStudent = async (
//   req: AuthenticatedRequest,
//   res: Response,
// ) => {
//   const User = req.user;
//   if (!User) {
//     return res.status(401).json({ error: "Unauthorized: Please log in first" });
//   }
//   if (User.role !== "admin") {
//     return res
//       .status(403)
//       .json({ error: "Unauthorize: Only admins can enroll students" });
//   }
//   try {
//     const { matricNumber, studentId, command } = req.body;
//     if (!matricNumber) {
//       return res.status(400).json({ error: "Matric number is required" });
//     }
//     if (!studentId) {
//       return res.status(400).json({ error: "Student ID is required" });
//     }
//     // Publish the matric number to the MQTT topic for enrollment
//     mqttClient.publish(
//       "enrollment",
//       JSON.stringify({
//         command: command, // "start" or "end"
//         matricNumber: matricNumber,
//         studentId: studentId,
//       }),
//       { qos: 1, retain: false },
//       (err) => {
//         if (err) {
//           console.error("Failed to trigger enrollment:", err);
//           return res.status(500).json({ error: "Failed to enroll student" });
//         }
//         console.log("Enrollment message published successfully");
//         res.status(200).json({
//           message: "kiosk is now in registration mode for " + matricNumber,
//         });
//       },
//     );
//   } catch (error: any) {
//     console.error("Error during enrollment:", error);
//     res.status(500).json({ error: "fail to trigger kiosk for enrollment" });
//   }
// };

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
    const { matricNumber, studentId, command } = req.body;
    if (!matricNumber) {
      return res.status(400).json({ error: "Matric number is required" });
    }
    if (!studentId) {
      return res.status(400).json({ error: "Student ID is required" });
    }

    // NEW: Check if MQTT is actually connected to HiveMQ!
    if (!mqttClient.connected) {
      console.error("MQTT client is offline. Cannot publish.");
      return res.status(500).json({
        error: "Kiosk is currently offline. Please check connection.",
      });
    }

    // Publish the matric number to the MQTT topic for enrollment
    mqttClient.publish(
      "enrollment",
      JSON.stringify({
        command: command, // "start" or "end"
        matricNumber: matricNumber,
        studentId: studentId,
      }),
      { qos: 1, retain: false },
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
    return res.status(403).json({
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

export const updateCourseSettings = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  const User = req.user;

  if (!User || User.role !== "admin") {
    return res.status(403).json({ error: "Unauthorized." });
  }

  try {
    const courseId = req.params.id;
    const { lecturerId, schedules } = req.body;

    await AdminService.updateCourseSettings(
      courseId as string,
      lecturerId,
      schedules,
    );

    res.status(200).json({ message: "Course settings saved successfully" });
  } catch (error: any) {
    console.error("Save Course Error:", error);
    res.status(500).json({ error: error.message || "Failed to save changes" });
  }
};
