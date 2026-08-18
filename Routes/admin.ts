import { Router } from "express";
import {
  createCourse,
  enrollStudent,
  getAllStudents,
  getAllCourses,
  updateCourseSettings,
  getAdminDashboardStats,
  getAllLecturers,
} from "../controllers/admin";

const enrollmentRoute = Router();

const getAllStudentsRoute = Router();
const createCourseRoute = Router();
const getAllLecturerRoute = Router();
const getAllCoursesRoute = Router();
const updateCourseSettingsRoute = Router();
const getAdminDashboardStatsRoute = Router();

getAdminDashboardStatsRoute.get("/adminDashboard", getAdminDashboardStats);
getAllStudentsRoute.get("/getallstudents", getAllStudents);
enrollmentRoute.post("/enrollment", enrollStudent);
createCourseRoute.post("/createCourse", createCourse);
getAllLecturerRoute.get("/getalllecturers", getAllLecturers);

getAllCoursesRoute.get("/getallcourses", getAllCourses);
updateCourseSettingsRoute.post("/courses/:id", updateCourseSettings);

export default enrollmentRoute;
export {
  enrollmentRoute,
  getAdminDashboardStatsRoute,
  getAllStudentsRoute,
  createCourseRoute,
  getAllLecturerRoute,
  getAllCoursesRoute,
  updateCourseSettingsRoute,
};
