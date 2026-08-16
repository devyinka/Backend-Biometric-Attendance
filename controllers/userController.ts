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
    if (User.role !== "student" && User.role !== "lecturer") {
      res.status(403).json({
        error:
          "Unauthorized: Only students and lecturers can update profile photo",
      });
      return;
    }

    const photoUrl = req.body?.photoUrl;
    const file = req.file as Express.Multer.File | undefined;

    if (!photoUrl && !file) {
      res.status(400).json({
        error: "Either an image file or photoUrl is required",
      });
      return;
    }

    const result = file
      ? await UserService.uploadProfilePhoto(User.id, file)
      : await UserService.updateProfilePhoto(User.id, photoUrl);

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
