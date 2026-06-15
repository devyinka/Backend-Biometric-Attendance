import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/authMiddleWare";
import { mqttClient } from "../config/MQTT/mqtt";

export const enrollStudent = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  const User = req.user;
  if (!User) {
    return res.status(401).json({ error: "Unauthorized: Please log in first" });
  }
  if (User.role !== "lecturer") {
    return res
      .status(403)
      .json({ error: "Unauthorize: Only lecturers can enroll students" });
  }
  try {
    const { matricNumber } = req.body;
    if (!matricNumber) {
      return res.status(400).json({ error: "Matric number is required" });
    }
    // Publish the matric number to the MQTT topic for enrollment
    mqttClient.publish(
      "enrollment",
      JSON.stringify({ command: "enroll", matricNumber: matricNumber }),
      (err) => {
        if (err) {
          console.error("Failed to publish enrollment message:", err);
          return res.status(500).json({ error: "Failed to enroll student" });
        }
        console.log("Enrollment message published successfully");
        res.status(200).json({
          message: "kiosk is now in registration mode for " + matricNumber,
        });
      },
    );
  } catch (error: any) {
    console.error("Error during enrollment:", error);
    res.status(500).json({ error: "fail to trigger kiosk for enrollment" });
  }
};
