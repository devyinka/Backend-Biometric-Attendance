import { Router } from "express";
import { enrollStudent, getAllStudents } from "../controllers/admin";

const enrollmentRoute = Router();

const getAllStudentsRoute = Router();

getAllStudentsRoute.get("/getallstudents", getAllStudents);

enrollmentRoute.post("/enroll", enrollStudent);

export default enrollmentRoute;
export { getAllStudentsRoute };
