import { Router } from "express";

import {
  markLiveAttendance,
  markOfflineAttendance,
  getAttendanceHistory,
} from "../controllers/attendanceController";
import { upload } from "../middleware/uploadImageMiddleware";

const AttendanceRoute = Router();

AttendanceRoute.post(
  "/mark-live",
  upload.single("liveImage"),
  markLiveAttendance,
);

AttendanceRoute.post("/mark-offline", markOfflineAttendance);

const GetAttendanceHistory = Router();

GetAttendanceHistory.get("/history", getAttendanceHistory);

export default AttendanceRoute;
export { GetAttendanceHistory };
