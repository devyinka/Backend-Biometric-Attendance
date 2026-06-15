import express from "express";
import cors from "cors";
import helmet from "helmet";
import { requireAuth } from "../../middleware/authMiddleWare";
import { requireLecturer } from "../../middleware/authMiddleWare";
import loginRoute from "../../Routes/loginRoute";
import registerRoute from "../../Routes/registerRoute";
import sendEmailandPassword from "../../Routes/sendEmailandPassword";
import updatePasswordRoute from "../../Routes/updatePassword";
import kioskRoute from "../../Routes/kioskRoute";
import enrollmentRoute from "../../Routes/enrollmentRoute";
import courseRoute from "../../Routes/courseRoute";
import studentRoute from "../../Routes/studentRoute";

export const app = express();

app.use(cors());
app.use(helmet());
app.use(express.json());

app.use("/", registerRoute);
app.use("/", sendEmailandPassword);
app.use("/", updatePasswordRoute);
app.use("/", kioskRoute);

// Apply authentication middleware globally for all routes after this point
app.use(requireAuth);
app.use("/", loginRoute);

// Aplly Role base acess for lecturer and student routes
app.use(requireLecturer);
app.use("/", enrollmentRoute);
app.use("/", courseRoute);
app.use("/", studentRoute);

