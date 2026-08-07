import { AuthService } from "../services/authentcationServices";

export const updatePassword = async (req: any, res: any) => {
  try {
    const { newPassword, accessToken, refreshToken } = req.body;
    if (!newPassword) {
      return res.status(400).json({ error: "New password is required" });
    }
    const response = await AuthService.updatePassword(
      newPassword,
      accessToken,
      refreshToken,
    );
    res.status(200).json(response);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
