import { Response, Request } from "express";
import { CourseService } from "../services/courseService";
import { Readable } from "stream";
import { AuthenticatedRequest } from "../middleware/authMiddleWare";

export const uploadCourse = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: "Unauthorized: Please log in first" });
    return;
  }
  if (user.role !== "lecturer") {
    res
      .status(403)
      .json({ error: "Unauthorized: Only lecturers can upload courses" });
    return;
  }

  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const stream = Readable.from(req.file.buffer);

    const result = await CourseService.uploadcourse(stream);

    if (!result) {
      res.status(500).json({ error: "Error uploading courses" });
      return;
    }

    res.status(200).json({
      message: "Courses uploaded successfully",
      data: result.data,
      warnings: result.warnings,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
