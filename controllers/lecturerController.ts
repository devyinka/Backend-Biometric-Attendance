import { Response } from "express";
import { LecturerService } from "../services/lecturerService";
import { AuthenticatedRequest } from "../middleware/authMiddleWare";

export const getLecturerDashboardData = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const user = req.user;

  if (!user) {
    res.status(401).json({ error: "Unauthorized: Please log in first" });
    return;
  }

  if (user.role !== "lecturer" && user.role !== "admin") {
    res.status(403).json({
      error:
        "Unauthorized: Access restricted to lecturer and admin accounts only",
    });
    return;
  }
  try {
    const result = await LecturerService.getLecturerDashboard(user.id);
    res.status(200).json({
      message: "Successfully fetched lecturer dashboard data",
      data: result,
    });
  } catch (error: any) {
    console.error("Fetch Lecturer Dashboard Controller Error:", error);

    res.status(500).json({
      error: error.message || "Failed to fetch lecturer dashboard system stats",
    });
  }
};
