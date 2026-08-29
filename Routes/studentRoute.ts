import { Router } from "express";
import {
  getActiveCourses,
  getAttendanceRecordsOfRegisteredCourses,
  getAvailableCourses,
  registerCourses,
} from "../controllers/studentController";

const studentRoute = Router();

studentRoute.get("/available-courses", getAvailableCourses);
studentRoute.post("/register-courses", registerCourses);
studentRoute.get(
  "/register-courses-attendance-details",
  getAttendanceRecordsOfRegisteredCourses,
);

studentRoute.get("/active-courses", getActiveCourses);

export default studentRoute;
