import { Request, Response } from "express";
import { AdminDatabase } from "../config/database/connectdatabase";
import { faceService } from "../services/faceService";
import { saveDebugKioskImage } from "../utilities/kioskimage";

export const submitBiometrics = async (req: Request, res: Response) => {
  try {
    const { matricNumber, fingerPrintSlot } = req.body;
    const face = req.file as Express.Multer.File | undefined;

    // ============================================================
    // 1. VALIDATE REQUEST
    // ============================================================
    if (!matricNumber || fingerPrintSlot === undefined || !face) {
      res.status(400).json({
        success: false,
        error: "Missing required biometric data or image file.",
      });
      return;
    }

    if (!face.buffer || face.buffer.length === 0) {
      res.status(400).json({
        success: false,
        error: "Uploaded image is empty or invalid.",
      });
      return;
    }

    // ============================================================
    // 2. VALIDATE FINGERPRINT SLOT
    // ============================================================
    const fingerprintSlot = Number.parseInt(String(fingerPrintSlot), 10);

    if (Number.isNaN(fingerprintSlot)) {
      res.status(400).json({
        success: false,
        error: "Invalid fingerprint slot.",
      });
      return;
    }

    console.log("==============================================");
    console.log("BIOMETRIC SUBMISSION RECEIVED");
    console.log("==============================================");
    console.log("Matric number:", matricNumber);
    console.log("Fingerprint slot:", fingerprintSlot);
    console.log("Image size:", face.buffer.length, "bytes");

    // ============================================================
    // 3. FIND STUDENT
    // ============================================================
    const { data: student, error: studentError } = await AdminDatabase.from(
      "user_profiles",
    )
      .select("id")
      .eq("matric_number", matricNumber)
      .maybeSingle();

    if (studentError) {
      console.error("Student database error:", studentError);

      res.status(500).json({
        success: false,
        error: studentError.message,
      });
      return;
    }

    if (!student) {
      console.log("Student not found:", matricNumber);

      res.status(404).json({
        success: false,
        error: "Student not found.",
      });
      return;
    }

    console.log("Student found:", student.id);

    // ============================================================
    // 4. COPY VALUES NEEDED BY BACKGROUND PROCESS
    // ============================================================
    //
    // Do not depend on the Express request object after we send
    // the response. Capture everything we need now.
    //
    const imageBuffer = Buffer.from(face.buffer);
    const studentId = student.id;
    const matric = String(matricNumber);

    // ============================================================
    // 5. RETURN IMMEDIATELY TO ESP32
    // ============================================================
    //
    // This is the important change.
    //
    // The ESP32 no longer needs to wait for:
    //
    //    faceService.facedetection()
    //    Supabase biometric insert
    //
    // The request is accepted and processing continues in
    // the background.
    //
    res.status(202).json({
      success: true,
      accepted: true,
      message: "Biometric data received. Processing started.",
      matricNumber: matric,
      fingerprintSlot,
    });

    console.log(
      "HTTP 202 sent to ESP32. Background biometric processing started.",
    );

    // ============================================================
    // 6. BACKGROUND PROCESSING
    // ============================================================
    //
    // setImmediate lets Express finish the HTTP request first.
    //
    setImmediate(async () => {
      try {
        console.log("==============================================");
        console.log("BACKGROUND BIOMETRIC PROCESSING");
        console.log("==============================================");
        console.log("Student:", studentId);
        console.log("Matric:", matric);
        console.log("Fingerprint slot:", fingerprintSlot);

        // --------------------------------------------------------
        // DEBUG IMAGE
        // --------------------------------------------------------
        try {
          const url = await saveDebugKioskImage(imageBuffer, matric);

          if (url) {
            console.log("==================================================");
            console.log("LATEST ESP32 CAPTURE URL:");
            console.log(url);
            console.log("==================================================");
          }
        } catch (debugError) {
          console.error("Debug image upload failed:", debugError);
        }

        // --------------------------------------------------------
        // FACE DETECTION / DESCRIPTOR GENERATION
        // --------------------------------------------------------
        console.log("Starting remote face detection...");

        const faceVector = await faceService.facedetection(imageBuffer);

        console.log("Face descriptor generated successfully.");

        // --------------------------------------------------------
        // SAVE BIOMETRIC DATA
        // --------------------------------------------------------
        const { error: insertError } = await AdminDatabase.from(
          "biometrics",
        ).insert({
          student_id: studentId,
          fingerprint_slot: fingerprintSlot,
          face_vector: faceVector,
        });

        if (insertError) {
          // Duplicate fingerprint slot
          if (insertError.code === "23505") {
            console.error("Biometric slot already in use.", {
              studentId,
              fingerprintSlot,
            });
            return;
          }

          console.error("Biometric database insert error:", insertError);

          throw insertError;
        }

        console.log("==============================================");
        console.log("BIOMETRIC PROCESSING SUCCESSFUL");
        console.log("Student:", studentId);
        console.log("Matric:", matric);
        console.log("Fingerprint slot:", fingerprintSlot);
        console.log("Biometric data saved successfully.");
        console.log("==============================================");
      } catch (backgroundError) {
        console.error("==============================================");
        console.error("BACKGROUND BIOMETRIC PROCESSING FAILED");
        console.error("==============================================");

        if (backgroundError instanceof Error) {
          console.error(backgroundError.message);
          console.error(backgroundError.stack);
        } else {
          console.error(backgroundError);
        }
      }
    });
  } catch (err: unknown) {
    console.error("=================================");
    console.error("KIOSK REQUEST ERROR");
    console.error("=================================");

    if (err instanceof Error) {
      console.error(err.message);
      console.error(err.stack);

      // Important:
      // Only send an HTTP response here if one has not already
      // been sent.
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: err.message,
        });
      }

      return;
    }

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: "An unexpected error occurred.",
      });
    }
  }
};
