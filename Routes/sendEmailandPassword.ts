import { Router } from "express";
import { sendEmailForPasswordUpdate } from "../controllers/sendEmailForPasswordUpdateController";

const sendEmailandPassword = Router();
sendEmailandPassword.post(
  "/send-email-for-password-update",
  sendEmailForPasswordUpdate,
);
export default sendEmailandPassword;
