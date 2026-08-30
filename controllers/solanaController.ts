
import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/authMiddleWare";
import { SolanaService } from "../services/solanaService";
import { SolanaBlockchainGateway } from "../gateWay/solanaBlockchainGateway";

export const verifyTransactionOnSolana = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const user = req.user;

  if (!user) {
    res.status(401).json({ error: "Unauthorized: Please log in first" });
    return;
  }

  if (
    user.role !== "student" &&
    user.role !== "lecturer" &&
    user.role !== "admin"
  ) {
    res.status(403).json({
      error:
        "Unauthorized: Only students, lecturers, and admins can verify transactions on Solana",
    });
    return;
  }

  try {
    const { signature } = req.params;

    if (!signature) {
      res.status(400).json({
        error: "Missing required parameter: signature",
      });
      return;
    }

    const verificationResult = await SolanaService.verifyReceipt(
      signature as string,
    );

    if (!verificationResult) {
      res.status(404).json({
        error: "Transaction not found on Solana.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      ...verificationResult,
    });
  } catch (error: any) {
    console.error("[VERIFY_TRANSACTION_ERROR]:", error);

    res.status(500).json({
      error: "Failed to verify transaction on Solana.",
    });
  }
};
/**
 * TEMPORARY BLOCKCHAIN TEST
 *
 * This bypasses:
 * - fingerprint
 * - face detection
 * - attendance database logic
 *
 * and directly tests:
 *
 * Backend -> SolanaBlockchainGateway -> Solana Program
 */
export const testAttendanceBlockchain = async (
  req: Request,
  res: Response,
): Promise<void> => {

  // ============================================================
  // DEBUG: CHECK IF CONTROLLER IS ACTUALLY BEING REACHED
  // ============================================================

  console.log("");
  console.log("================================================");
  console.log("🔥🔥🔥 BLOCKCHAIN TEST CONTROLLER REACHED 🔥🔥🔥");
  console.log("================================================");

  console.log("HTTP Method:", req.method);
  console.log("URL:", req.originalUrl);
  console.log("Body received:", req.body);
  console.log("Headers:", req.headers);

  try {
    const {
      studentId,
      sessionId,
      deviceId = "postman-test",
    } = req.body;

    console.log("");
    console.log("========== REQUEST DATA ==========");
    console.log("studentId:", studentId);
    console.log("sessionId:", sessionId);
    console.log("deviceId:", deviceId);
    console.log("==================================");

    if (!studentId || !sessionId) {
      console.log("❌ Missing studentId or sessionId");

      res.status(400).json({
        success: false,
        error: "studentId and sessionId are required",
      });
      return;
    }

    console.log("");
    console.log("🚀 Starting Solana blockchain test...");
    console.log("");

    // ============================================================
    // 1. WRITE ATTENDANCE PROOF TO SOLANA
    // ============================================================

    console.log("⛓️ STEP 1: Calling recordAttendanceHash()...");

    const txHash =
      await SolanaBlockchainGateway.recordAttendanceHash(
        studentId,
        sessionId,
        deviceId,
      );

    console.log("✅ STEP 1 SUCCESS");
    console.log("Transaction signature:", txHash);

    // ============================================================
    // 2. VERIFY HASH STORED IN PDA
    // ============================================================

    console.log("");
    console.log("🔐 STEP 2: Verifying attendance hash...");

    const verified =
      await SolanaBlockchainGateway.verifyAttendanceHash(
        studentId,
        sessionId,
        deviceId,
      );

    console.log("Verification result:", verified);

    if (verified) {
      console.log("✅ STEP 2 SUCCESS: Hash is valid");
    } else {
      console.log("❌ STEP 2 FAILED: Hash verification returned false");
    }

    // ============================================================
    // 3. READ THE ACTUAL RECORD FROM SOLANA
    // ============================================================

    console.log("");
    console.log("📦 STEP 3: Reading attendance record from Solana...");

    const record =
      await SolanaBlockchainGateway.getAttendanceRecord(
        studentId,
        sessionId,
      );

    console.log("Blockchain record:", record);

    if (record) {
      console.log("✅ STEP 3 SUCCESS: PDA record found");
    } else {
      console.log("❌ STEP 3 FAILED: PDA record not found");
    }

    // ============================================================
    // TEST COMPLETE
    // ============================================================

    console.log("");
    console.log("================================================");
    console.log("🎉🎉🎉 BLOCKCHAIN TEST COMPLETED 🎉🎉🎉");
    console.log("================================================");

    res.status(200).json({
      success: true,
      message: "Blockchain attendance test completed",

      transaction: {
        txHash,
      },

      verification: {
        verified,
      },

      blockchainRecord: record,
    });

  } catch (error: any) {

    console.log("");
    console.log("================================================");
    console.log("❌❌❌ BLOCKCHAIN TEST FAILED ❌❌❌");
    console.log("================================================");

    console.error("Error:", error);
    console.error("Error message:", error?.message);
    console.error("Error stack:", error?.stack);

    console.log("================================================");

    res.status(500).json({
      success: false,
      error: error?.message || "Blockchain test failed",
    });
  }
};





/*


import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/authMiddleWare";
import { SolanaService } from "../services/solanaService";

export const verifyTransactionOnSolana = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const user = req.user;

  if (!user) {
    res.status(401).json({ error: "Unauthorized: Please log in first" });
    return;
  }
  if (
    user.role !== "student" &&
    user.role !== "lecturer" &&
    user.role !== "admin"
  ) {
    res.status(403).json({
      error:
        "Unauthorized: Only students, lecturers, and admins can verify transactions on Solana",
    });
    return;
  }

  try {
    const { signature } = req.params;
    if (!signature) {
      res.status(400).json({ error: "Missing required parameter: signature" });
      return;
    }

    const verificationResult = await SolanaService.verifyReceipt(
      signature as string,
    );

    if (!verificationResult) {
      res.status(404).json({ error: "Transaction not found on Solana." });
      return;
    }

    res.status(200).json({
      success: true,
      ...verificationResult,
    });
  } catch (error: any) {
    console.error("[VERIFY_TRANSACTION_ERROR]:", error);
    res.status(500).json({ error: "Failed to verify transaction on Solana." });
  }
};

*/