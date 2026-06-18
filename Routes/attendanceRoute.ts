import { Router } from "express";

import {
  markLiveAttendance,
  markOfflineAttendance,
  getAttendanceHistory,
} from "../controllers/attendanceController";
import { upload } from "../middleware/uploadImageMiddleware";
import { get } from "https";

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
