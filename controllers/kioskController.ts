import { Request, Response } from "express";
import { AdminDatabase } from "../config/database/connectdatabase";
import { faceService } from "../services/faceService";
import { saveDebugKioskImage } from "../utilities/kioskimage";

export const submitBiometrics = async (req: Request, res: Response) => {
  try {
    const { matricNumber, fingerPrintSlot } = req.body;
    const face = req.file as Express.Multer.File | undefined;

    if (!matricNumber || fingerPrintSlot === undefined || !face) {
      res
        .status(400)
        .json({ error: "Missing required biometric data or image file." });
      return;
    }

    if (!face.buffer || face.buffer.length === 0) {
      res.status(400).json({ error: "Uploaded image is empty or invalid." });
      return;
    }

    console.log("Biometric submission received");
    console.log("Matric number:", matricNumber);
    console.log("Fingerprint slot:", fingerPrintSlot);

    // -----------------------------------------
    // Find student
    // -----------------------------------------
    const { data: student, error: studentError } = await AdminDatabase.from(
      "user_profiles",
    )
      .select("id")
      .eq("matric_number", matricNumber)
      .maybeSingle();

    if (studentError) {
      console.error("Student database error:", studentError);
      res.status(500).json({ error: studentError.message });
      return;
    }

    if (!student) {
      res.status(404).json({ error: "Student not found." });
      return;
    }

    console.log("Student found:", student.id);

    saveDebugKioskImage(face.buffer, matricNumber)
      .then((url) => {
        if (url) {
          console.log("==================================================");
          console.log("📸 LATEST ESP32 CAPTURE URL (Click to view):");
          console.log(url);
          console.log("==================================================");
        }
      })
      .catch((err) => console.error("Debug upload failed in background:", err));
    // =========================================

    // -----------------------------------------
    // Generate face descriptor (via Microservice)
    // -----------------------------------------
    console.log("Starting remote face detection...");
    const faceVector = await faceService.facedetection(face.buffer);

    // -----------------------------------------
    // Save biometric data
    // -----------------------------------------
    const fingerprintSlot = Number.parseInt(String(fingerPrintSlot), 10);

    if (Number.isNaN(fingerprintSlot)) {
      res.status(400).json({ error: "Invalid fingerprint slot." });
      return;
    }

    const { error: insertError } = await AdminDatabase.from(
      "biometrics",
    ).insert({
      student_id: student.id,
      fingerprint_slot: fingerprintSlot,
      face_vector: faceVector,
    });

    if (insertError) {
      // Handle Supabase unique constraint error for duplicate slots
      if (insertError.code === "23505") {
        res.status(409).json({ error: "Biometric slot is already in use." });
        return;
      }
      console.error("Biometric database insert error:", insertError);
      throw insertError;
    }

    console.log("Biometric data saved successfully.");
    res.status(201).json({ message: "Biometrics successfully saved." });
  } catch (err: unknown) {
    console.error("=================================");
    console.error("Kiosk Error");
    console.error("=================================");
    console.error(err);

    if (err instanceof Error) {
      res.status(500).json({ error: err.message });
      return;
    }

    res.status(500).json({ error: "An unexpected error occurred." });
  }
};
