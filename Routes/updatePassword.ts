import { Router } from "express";
import { updatePassword } from "../controllers/updatePasswordController";

const updatePasswordRoute = Router();
updatePasswordRoute.post("/update-password", updatePassword);

export default updatePasswordRoute;
