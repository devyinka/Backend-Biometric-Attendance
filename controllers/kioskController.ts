import { Request, Response } from "express";
import { AdminDatabase } from "../config/database/connectdatabase";
import { faceService } from "../services/faceService";
import multer from "multer";

// Controller to handle biometric data submission from the kiosk, its general route.
export const submitBiometrics = async (req: Request, res: Response) => {
  try {
    const { matricNumber, fingerPrintSlot } = req.body;
    const face = req.file as Express.Multer.File;

    if (!matricNumber || fingerPrintSlot === undefined || !face) {
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

    const faceVector = await faceService.facedetection(face.buffer);

    const { error: insertError } = await AdminDatabase.from(
      "biometrics",
    ).insert({
      student_id: student.id,
      fingerprint_slot: parseInt(fingerPrintSlot, 10),
      face_vector: faceVector,
    });

    if (insertError) throw insertError;

    res.status(201).json({ message: "Biometrics successfully saved." });
  } catch (err: any) {
    console.error("Kiosk Error:", err.message);
    res.status(500).json({ error: err.message });
  }
};
