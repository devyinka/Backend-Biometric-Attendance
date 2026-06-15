import Router from "express";
import { registerUser } from "../controllers/registerUserController";

const registerRoute = Router();
registerRoute.post("/register", registerUser);

export default registerRoute;
