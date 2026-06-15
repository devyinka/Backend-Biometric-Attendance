import Router from "express";
import { loginUser } from "../controllers/loginUserController";

const loginRoute = Router();
loginRoute.post("/login", loginUser);

export default loginRoute;
