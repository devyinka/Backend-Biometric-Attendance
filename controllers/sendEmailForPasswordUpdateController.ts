import { AuthService } from "../services/authentcationServices";
export const sendEmailForPasswordUpdate = async (req: any, res: any) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }
    const response = await AuthService.sendEmailForPasswordUpdate(email);
    res.status(200).json(response);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
