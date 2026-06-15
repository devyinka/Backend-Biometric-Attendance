import { Router } from "express";
import { enrollStudent } from "../controllers/enrollmentController";

const enrollmentRoute = Router();

enrollmentRoute.post("/enroll", enrollStudent);

export default enrollmentRoute;
