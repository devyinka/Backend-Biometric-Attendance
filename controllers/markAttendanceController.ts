import { Request, Response } from "express";
import { AttendanceTaking } from "../services/markingAttendanceService";

export const markLiveAttendance = async (req: Request, res: Response) => {
  try {
    const { fingerprintSlot, courseId } = req.body;
    const liveImageBuffer = req.file?.buffer;

    const fingerprintSlotInt = parseInt(fingerprintSlot, 10); // Ensure fingerprintSlot is an integer

    if (isNaN(fingerprintSlotInt) || !courseId || !liveImageBuffer) {
      res.status(400).json({ error: "Missing required data" });
      return;
    }

    const result = await AttendanceTaking.markLiveAttendance(
      liveImageBuffer,
      fingerprintSlotInt,
      courseId,
    );

    res.status(200).json(result);
  } catch (error: any) {
    console.error("Error marking live attendance:", error);
    res.status(500).json({ error: "Failed to mark live attendance" });
  }
};

export const markOfflineAttendance = async (req: Request, res: Response) => {
  try {
    const { scans, courseId } = req.body;
    if (!courseId) {
      res.status(400).json({ error: "Missing courseId" });
      return;
    }
    if (!Array.isArray(scans) || scans.length === 0) {
      res.status(400).json({ error: "Scans must be a non-empty array" });
      return;
    }

    const result = await AttendanceTaking.markOfflineAttendance(
      scans,
      courseId,
    );
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Error marking offline attendance:", error);
    res.status(500).json({ error: "Failed to mark offline attendance" });
  }
};
