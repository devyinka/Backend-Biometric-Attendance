import { Router } from "express";
import {
  startSession,
  getActiveSession,
  endSession,
} from "../controllers/classSessionController";

const classSessionRoute = Router();

classSessionRoute.post("/start-session", startSession);
classSessionRoute.get("/active-session/:courseId", getActiveSession);
classSessionRoute.post("/end-session/", endSession);

export default classSessionRoute;
