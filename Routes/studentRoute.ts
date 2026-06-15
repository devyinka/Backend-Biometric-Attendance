import { Router } from "express";
import {
  getAvailableCourses,
  registerCourses,
} from "../controllers/studentController";

const studentRoute = Router();

studentRoute.get("/available-courses", getAvailableCourses);
studentRoute.post("/register-courses", registerCourses);

export default studentRoute;
