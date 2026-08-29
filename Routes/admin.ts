import { Router } from "express";
import {
  createCourse,
  enrollStudent,
  getAllStudents,
  getAllCourses,
  updateCourseSettings,
  getAdminDashboardStats,
  getAllLecturers,
  getAttendanceOverview,
  getAttendanceRecords,
} from "../controllers/admin";

const adminRoute = Router();

adminRoute.get("/adminDashboard", getAdminDashboardStats);
adminRoute.get("/attendanceOverview", getAttendanceOverview);
adminRoute.get("/attendanceRecords", getAttendanceRecords);
adminRoute.get("/attendanceRecords/:courseId", getAttendanceRecords);
adminRoute.get("/getallstudents", getAllStudents);
adminRoute.post("/enrollment", enrollStudent);
adminRoute.post("/createCourse", createCourse);
adminRoute.get("/getalllecturers", getAllLecturers);
adminRoute.get("/getallcourses", getAllCourses);
adminRoute.post("/courses/:id", updateCourseSettings);

export default adminRoute;
