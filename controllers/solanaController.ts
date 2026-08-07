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
