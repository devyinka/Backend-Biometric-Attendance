import { AuthService } from "../services/authentcationServices";

export const updatePassword = async (req: any, res: any) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword) {
      return res.status(400).json({ error: "New password is required" });
    }
    const response = await AuthService.updatePassword(newPassword);
    res.status(200).json(response);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
