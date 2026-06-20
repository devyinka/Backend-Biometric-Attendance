import express from "express";
import cors from "cors";
import helmet from "helmet";
import { requireAuth } from "../../middleware/authMiddleWare";
import { requireLecturerorstudent } from "../../middleware/authMiddleWare";
import loginRoute from "../../Routes/loginRoute";
import registerRoute from "../../Routes/registerRoute";
import sendEmailandPassword from "../../Routes/sendEmailandPassword";
import updatePasswordRoute from "../../Routes/updatePassword";
import kioskRoute from "../../Routes/kioskRoute";
import enrollmentRoute from "../../Routes/enrollmentRoute";
import courseRoute from "../../Routes/courseRoute";
import studentRoute from "../../Routes/studentRoute";
import classSessionRoute from "../../Routes/classSessionRoute";
import userRouter from "../../Routes/userRouter";
import AttendanceRoute, {
  GetAttendanceHistory,
} from "../../Routes/attendanceRoute";

export const app = express();

app.use(cors());
app.use(helmet());
app.use(express.json());

app.use("/", registerRoute);
app.use("/", loginRoute);
app.use("/", sendEmailandPassword);
app.use("/", kioskRoute);
app.use("/", AttendanceRoute);

// Apply authentication middleware globally for all routes after this point
app.use(requireAuth);
app.use("/", updatePasswordRoute);
// Aplly Role base acess for lecturer and student routes
app.use(requireLecturerorstudent);
app.use("/", enrollmentRoute);
app.use("/", courseRoute);
app.use("/", studentRoute);
app.use("/", classSessionRoute);
app.use("/", userRouter);
app.use("/", GetAttendanceHistory);
