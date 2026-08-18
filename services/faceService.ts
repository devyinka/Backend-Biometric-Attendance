import { Request, Response } from "express";
import { AdminDatabase } from "../config/database/connectdatabase";

import * as tf from "@tensorflow/tfjs-node";
import * as faceapi from "@vladmandic/face-api";
import path from "path";

/**
 * Initialize TensorFlow before using face-api.
 */
let tensorflowInitialized = false;

async function initializeTensorFlow() {
  if (tensorflowInitialized) {
    return;
  }

  await tf.ready();

  console.log("TensorFlow backend:", tf.getBackend());

  tensorflowInitialized = true;
}

export const submitBiometrics = async (req: Request, res: Response) => {
  try {
    const { matricNumber, fingerPrintSlot } = req.body;

    const face = req.file as Express.Multer.File | undefined;

    // -----------------------------------------
    // Validate request data
    // -----------------------------------------

    if (!matricNumber || fingerPrintSlot === undefined || !face) {
      res.status(400).json({
        error: "Missing required biometric data or image file.",
      });

      return;
    }

    // -----------------------------------------
    // Validate image buffer
    // -----------------------------------------

    if (!face.buffer || face.buffer.length === 0) {
      res.status(400).json({
        error: "Uploaded image is empty or invalid.",
      });

      return;
    }

    console.log("Biometric submission received");
    console.log("Matric number:", matricNumber);
    console.log("Fingerprint slot:", fingerPrintSlot);
    console.log("Image size:", face.buffer.length, "bytes");

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

      res.status(500).json({
        error: studentError.message,
      });

      return;
    }

    if (!student) {
      res.status(404).json({
        error: "Student not found.",
      });

      return;
    }

    console.log("Student found:", student.id);

    // -----------------------------------------
    // Generate face descriptor
    // -----------------------------------------

    console.log("Starting face detection...");

    const faceVector = await faceService.facedetection(face.buffer);

    console.log("Face descriptor generated successfully.");

    console.log("Descriptor length:", faceVector.length);

    // -----------------------------------------
    // Save biometric data
    // -----------------------------------------

    const fingerprintSlot = Number.parseInt(String(fingerPrintSlot), 10);

    if (Number.isNaN(fingerprintSlot)) {
      res.status(400).json({
        error: "Invalid fingerprint slot.",
      });

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
      console.error("Biometric database insert error:", insertError);

      throw insertError;
    }

    console.log("Biometric data saved successfully.");

    res.status(201).json({
      message: "Biometrics successfully saved.",
    });
  } catch (err: unknown) {
    console.error("=================================");
    console.error("Kiosk Error");
    console.error("=================================");

    console.error(err);

    if (err instanceof Error) {
      console.error("Message:", err.message);
      console.error("Stack:", err.stack);

      res.status(500).json({
        error: err.message,
      });

      return;
    }

    res.status(500).json({
      error: "An unexpected error occurred.",
    });
  }
};

export const faceService = {
  /**
   * Load all required face-api models.
   */
  async loadModels() {
    await initializeTensorFlow();

    /**
     * Resolve the models directory from the backend
     * working directory.
     *
     * Expected structure:
     *
     * backend/
     * ├── models/
     * │   ├── ssd_mobilenetv1_model-weights_manifest.json
     * │   ├── ...
     * ├── src/
     * └── ...
     */
    const modelPath = path.resolve(process.cwd(), "models");

    console.log("Loading face models from:", modelPath);

    await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelPath);

    console.log("SSD MobileNet model loaded");

    await faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath);

    console.log("Face landmark model loaded");

    await faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath);

    console.log("Face recognition model loaded");
  },

  /**
   * Generate a 128-dimensional face descriptor
   * from an uploaded image.
   */
  facedetection: async (imageBuffer: Buffer): Promise<number[]> => {
    await initializeTensorFlow();

    console.log("FACE: received image");
    console.log("FACE: image size:", imageBuffer.length);

    let tensor: tf.Tensor3D | null = null;

    try {
      console.log("FACE: decoding image...");

      tensor = tf.node.decodeImage(imageBuffer, 3) as tf.Tensor3D;

      console.log("FACE: image decoded");
      console.log("FACE: tensor shape:", tensor.shape);

      console.log("FACE: starting detectSingleFace...");

      const detection = await faceapi
        .detectSingleFace(tensor)
        .withFaceLandmarks()
        .withFaceDescriptor();

      console.log("FACE: detection finished");

      if (!detection) {
        throw new Error("No face detected in the image.");
      }

      console.log("FACE: descriptor generated");

      return Array.from(detection.descriptor);
    } catch (error: unknown) {
      console.error("========== FACE ERROR ==========");
      console.error(error);

      if (error instanceof Error) {
        console.error("Message:", error.message);
        console.error("Stack:", error.stack);
      }

      console.error("================================");

      throw error;
    } finally {
      if (tensor) {
        tf.dispose(tensor);
        console.log("FACE: tensor disposed");
      }
    }
  },

  /**
   * Compare an enrolled face descriptor
   * against a newly detected descriptor.
   */
  async verifyFace(
    enrolledface: number[],
    detectedface: number[],
  ): Promise<boolean> {
    if (!Array.isArray(enrolledface) || !Array.isArray(detectedface)) {
      throw new Error("Invalid face descriptor data.");
    }

    if (enrolledface.length === 0 || detectedface.length === 0) {
      throw new Error("Face descriptor cannot be empty.");
    }

    const floatEnrolled = new Float32Array(enrolledface);

    const floatNew = new Float32Array(detectedface);

    const distance = faceapi.euclideanDistance(floatEnrolled, floatNew);

    console.log("Face distance:", distance);

    return distance < 0.5;
  },
};
