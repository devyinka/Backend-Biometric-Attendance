import express from "express";
import cors from "cors";
import compression from "compression";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
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
import lecturerRouter from "../../Routes/lecturerRoute";

export const app = express();
app.set("trust proxy", 1);

// Basic security headers (helmet) and gzip compression for better performance.
app.use(helmet());
app.use(compression());

// Request logging in development for easier debugging.
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

// Parse incoming cookies and JSON/form bodies.
app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

const allowedOrigin = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["http://localhost:3000"];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigin.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  }),
);

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

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
app.use("/", studentRoute); // i  will test this
app.use("/", classSessionRoute);
app.use("/", userRouter); // i will test this too
app.use("/", GetAttendanceHistory); // i will test this too
app.use("/", lecturerRouter);
