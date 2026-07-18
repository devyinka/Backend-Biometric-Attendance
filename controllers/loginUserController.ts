import { Response } from "express";
import { AuthService } from "../services/authentcationServices";
import { AuthenticatedRequest } from "../middleware/authMiddleWare";

export const loginUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    if (!role) {
      return res.status(400).json({ error: "Role is required" });
    }
    const response = await AuthService.loginUser({ email, password });
    res.status(200).json(response);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
