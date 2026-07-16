import { Router } from "express";
import {
  createCourse,
  enrollStudent,
  getAllLecturers,
  getAllStudents,
  getAllCourses,
} from "../controllers/admin";

const enrollmentRoute = Router();

const getAllStudentsRoute = Router();
const createCourseRoute = Router();
const getAllLecturerRoute = Router();
const getAllCoursesRoute = Router();

getAllStudentsRoute.get("/getallstudents", getAllStudents);
enrollmentRoute.post("/enrollment", enrollStudent);
createCourseRoute.post("/createCourse", createCourse);
getAllLecturerRoute.get("/getalllecturers", getAllLecturers);
getAllCoursesRoute.get("/getallcourses", getAllCourses);

export default enrollmentRoute;
export {
  getAllStudentsRoute,
  createCourseRoute,
  getAllLecturerRoute,
  getAllCoursesRoute,
};
