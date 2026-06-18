import { AuthenticatedRequest } from "../middleware/authMiddleWare";
import { Response } from "express";
import { UserService } from "../services/userService";

export const UpadteProfilephoto = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const User = req.user;
    if (!User) {
      res.status(401).json({ error: "Unauthorized: Please log in first" });
      return;
    }
    if (User.role !== "student") {
      res
        .status(403)
        .json({
          error: "Unauthorized: Only students can update profile photo",
        });
      return;
    }

    const { userId, photoUrl } = req.body;

    if (!userId || !photoUrl) {
      res.status(400).json({ error: "userId and photoUrl are required" });
      return;
    }

    const result = await UserService.updateProfilePhoto(userId, photoUrl);

    res.status(200).json({
      status: "success",
      message: "Profile image updated successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("Update Profile Photo Error:", error);
    res
      .status(500)
      .json({ error: error.message || "Failed to update profile photo" });
  }
};
