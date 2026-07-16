import { Request, Response } from "express";
import { AdminDatabase } from "../config/database/connectdatabase";
import { faceService } from "../services/faceService";
import multer from "multer";

// Controller to handle biometric data submission from the kiosk, its general route.
export const submitBiometrics = async (req: Request, res: Response) => {
  try {
    const { matricNumber, fingerprintSlot } = req.body;
    const file = req.file as Express.Multer.File;

    if (!matricNumber || fingerprintSlot === undefined || !file) {
      res
        .status(400)
        .json({ error: "Missing required biometric data or image file." });
      return;
    }

    const { data: student, error: studentError } = await AdminDatabase.from(
      "user_profiles",
    )
      .select("id")
      .eq("matric_number", matricNumber)
      .maybeSingle();

    if (studentError || !student) {
      res
        .status(404)
        .json({ error: studentError?.message || "Student not found." });
      return;
    }

    const faceVector = await faceService.facedetection(file.buffer);

    const { error: insertError } = await AdminDatabase.from(
      "biometrics",
    ).insert({
      student_id: student.id,
      fingerprint_slot: parseInt(fingerprintSlot, 10),
      face_vector: faceVector,
    });

    if (insertError) throw insertError;

    res.status(201).json({ message: "Biometrics successfully saved." });
  } catch (err: any) {
    console.error("Kiosk Error:", err.message);
    res.status(500).json({ error: "Failed to process biometrics." });
  }
};
