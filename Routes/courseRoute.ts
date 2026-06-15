import { Router } from "express";
import { uploadCSV } from "../middleware/uploadImageMiddleware";
import { uploadCourse } from "../controllers/courseController";

const courseRoute = Router();

courseRoute.post(
  "/upload-course",
  uploadCSV.single("courseFile"),
  uploadCourse,
);

export default courseRoute;
