import { Router } from 'express';

import {
  markLiveAttendance,
  markOfflineAttendance,
  getAttendanceHistory,
  getAttendanceBlockchainRecord,
  getSemesterReport,
} from '../controllers/attendanceController';
import { upload } from '../middleware/uploadImageMiddleware';

const AttendanceRoute = Router();

AttendanceRoute.post('/mark-live', upload.single('face'), markLiveAttendance);

AttendanceRoute.post('/mark-offline', markOfflineAttendance);

const GetAttendanceHistory = Router();

GetAttendanceHistory.get('/history', getAttendanceHistory);
GetAttendanceHistory.get('/blockchain-record', getAttendanceBlockchainRecord);

const getsemesterAttendanceHistory = Router();

getsemesterAttendanceHistory.get('/courses/:courseId/semester-report', getSemesterReport);
export { getsemesterAttendanceHistory };

export default AttendanceRoute;
export { GetAttendanceHistory };
