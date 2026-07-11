import { Router } from "express";
import { getLecturerDashboardData } from "../controllers/lecturerController";

const lecturerRouter = Router();

lecturerRouter.get("/lecturerDashboard", getLecturerDashboardData);

export default lecturerRouter;
