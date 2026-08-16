import { Router } from "express";
import multer from "multer";
import { UpadteProfilephoto } from "../controllers/userController";

const userRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

userRouter.post(
  "/update-profile-photo",
  upload.single("image"),
  UpadteProfilephoto,
);

export default userRouter;
