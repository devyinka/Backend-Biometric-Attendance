import { Request, Response } from "express";
import { AdminDatabase } from "../config/database/connectdatabase";
import multer from "multer";

import * as tf from "@tensorflow/tfjs-node";
import * as faceapi from "@vladmandic/face-api";
import * as util from "util";

if (typeof (util as any).isNullOrUndefined !== "function") {
  (util as any).isNullOrUndefined = (obj: any) =>
    obj === null || obj === undefined;
}

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
  } catch (err: unknown) {
    console.error("========== KIOSK ERROR ==========");
    console.error(err);

    if (err instanceof Error) {
      console.error("Message:", err.message);
      console.error("Stack:", err.stack);
    }

    console.error("================================");

    res.status(500).json({
      error: err instanceof Error ? err.message : "Unknown kiosk error",
    });
  }
};

export const faceService = {
  async loadModels() {
    const modelPath = "./models";
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelPath);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath);
  },

  facedetection: async (imageBuffer: Buffer): Promise<number[]> => {
    //  Use the globally imported tf object
    const Tensor = tf.node.decodeImage(imageBuffer, 3) as tf.Tensor3D;

    try {
      const detection = await faceapi
        .detectSingleFace(Tensor)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        throw new Error("No face detected in the image");
      }

      return Array.from(detection.descriptor);
    } finally {
      // 4. Always dispose to prevent memory leaks in Node
      tf.dispose(Tensor);
    }
  },

  verifyFace: async (
    enrolledface: number[],
    detectedface: number[],
  ): Promise<boolean> => {
    const floatEnrolled = new Float32Array(enrolledface);
    const floatNew = new Float32Array(detectedface);

    const distance = faceapi.euclideanDistance(floatEnrolled, floatNew);

    return distance < 0.5;
  },
};
