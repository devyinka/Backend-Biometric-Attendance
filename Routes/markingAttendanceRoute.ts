import { Router } from "express";

import {
  markLiveAttendance,
  markOfflineAttendance,
} from "../controllers/markAttendanceController";
import { upload } from "../middleware/uploadImageMiddleware";

const markingAttendanceRoute = Router();

markingAttendanceRoute.post(
  "/mark-live",
  upload.single("liveImage"),
  markLiveAttendance,
);

markingAttendanceRoute.post("/mark-offline", markOfflineAttendance);

export default markingAttendanceRoute;
