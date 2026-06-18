import { Router } from "express";
import { UpadteProfilephoto } from "../controllers/userController";

const userRouter = Router();
userRouter.post("/update-profile-photo", UpadteProfilephoto);

export default userRouter;
