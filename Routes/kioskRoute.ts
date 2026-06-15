import { Router } from "express";
import { upload } from "../middleware/uploadImageMiddleware";
import { submitBiometrics } from "../controllers/kioskController";

const kioskRoute = Router();

kioskRoute.post(
  "/submit-biometrics",
  upload.single("faceImage"),
  submitBiometrics,
);

export default kioskRoute;
