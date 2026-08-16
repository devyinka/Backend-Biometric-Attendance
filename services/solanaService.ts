import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  clusterApiUrl,
} from "@solana/web3.js";

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || clusterApiUrl("devnet");
const connection = new Connection(SOLANA_RPC_URL, "confirmed");

// Official Solana Memo Program ID (SPL Memo v2)
const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
);

const getPayerKeypair = (): Keypair => {
  if (!process.env.SOLANA_PRIVATE_KEY) {
    throw new Error("SOLANA_PRIVATE_KEY environment variable is not set");
  }
  const secretKey = Uint8Array.from(JSON.parse(process.env.SOLANA_PRIVATE_KEY));
  return Keypair.fromSecretKey(secretKey);
};

export const SolanaService = {
  recordAttendance: async (
    studentId: string,
    sessionId: string,
  ): Promise<string> => {
    const payer = getPayerKeypair();
    const memoData = JSON.stringify({
      studentId,
      sessionId,
      timestamp: new Date().toISOString(),
    });

    const memoInstruction = new TransactionInstruction({
      keys: [{ pubkey: payer.publicKey, isSigner: true, isWritable: true }],
      programId: MEMO_PROGRAM_ID,
      data: Buffer.from(memoData, "utf-8"),
    });

    const transaction = new Transaction().add(memoInstruction);

    // Send and confirm transaction on Solana
    const signature = await sendAndConfirmTransaction(connection, transaction, [
      payer,
    ]);

    return signature;
  },

  verifyReceipt: async (signature: string) => {
    try {
      // Fetch the parsed transaction details from Solana nodes
      const transactionDetails = await connection.getParsedTransaction(
        signature,
        {
          maxSupportedTransactionVersion: 0,
          commitment: "confirmed",
        },
      );

      if (!transactionDetails || !transactionDetails.blockTime) {
        return { verified: false };
      }

      // Extract the memo instruction payload
      const instructions = transactionDetails.transaction.message.instructions;
      let studentId = "Unknown";
      let sessionId = "Unknown";

      for (const inst of instructions) {
        if ("program" in inst && inst.program === "spl-memo") {
          try {
            const memoText = inst.parsed as string;
            const transactionData = JSON.parse(memoText);
            studentId = transactionData.studentId || studentId;
            sessionId = transactionData.sessionId || sessionId;
          } catch {}
        }
      }

      return {
        verified: true,
        signature: signature,
        slot: transactionDetails.slot,
        timestamp: new Date(transactionDetails.blockTime * 1000).toISOString(),
        studentId,
        sessionId,
        programId: MEMO_PROGRAM_ID.toBase58(),
      };
    } catch (error) {
      console.error("[SOLANA_VERIFY_ERROR]", error);
      return { verified: false };
    }
  },
};
