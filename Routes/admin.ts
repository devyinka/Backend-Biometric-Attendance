import { Router } from "express";
import {
  createCourse,
  enrollStudent,
  getAllLecturers,
  getAllStudents,
} from "../controllers/admin";

const enrollmentRoute = Router();

const getAllStudentsRoute = Router();
const createCourseRoute = Router();
const getAllLecturer = Router();

getAllStudentsRoute.get("/getallstudents", getAllStudents);
enrollmentRoute.post("/enrollment", enrollStudent);
createCourseRoute.post("/createCourse", createCourse);
getAllLecturer.get("/getalllecturers", getAllLecturers);

export default enrollmentRoute;
export { getAllStudentsRoute, createCourseRoute, getAllLecturer };
