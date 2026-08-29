
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  SendTransactionError,
} from "@solana/web3.js";

import * as crypto from "crypto";

// ============================================================
// ENVIRONMENT VARIABLES
// ============================================================

const rpcUrl =
  process.env.SOLANA_RPC_URL ||
  "https://api.devnet.solana.com";

const programIdString =
  process.env.SOLANA_PROGRAM_ID;

const walletPrivateKey =
  process.env.SOLANA_WALLET_PRIVATE_KEY;

// ============================================================
// ENVIRONMENT VALIDATION
// ============================================================

if (!programIdString) {
  throw new Error(
    "Missing SOLANA_PROGRAM_ID in environment",
  );
}

if (!walletPrivateKey) {
  throw new Error(
    "Missing SOLANA_WALLET_PRIVATE_KEY in environment",
  );
}

// ============================================================
// SOLANA CONNECTION
// ============================================================

const connection = new Connection(
  rpcUrl,
  "confirmed",
);

// ============================================================
// PROGRAM ID
// ============================================================

const programId =
  new PublicKey(programIdString);

console.log("========================================");
console.log("⛓️ SOLANA CONFIGURATION");
console.log("RPC URL:", rpcUrl);
console.log("Program ID:", programId.toBase58());
console.log("========================================");

// ============================================================
// WALLET / PAYER
// ============================================================

let secretKey: Uint8Array;

try {
  const parsedKey =
    JSON.parse(walletPrivateKey);

  if (!Array.isArray(parsedKey)) {
    throw new Error(
      "SOLANA_WALLET_PRIVATE_KEY must be a JSON array",
    );
  }

  if (parsedKey.length !== 64) {
    throw new Error(
      `Invalid Solana secret key size. Expected 64 bytes, got ${parsedKey.length}`,
    );
  }

  secretKey =
    Uint8Array.from(parsedKey);
} catch (error) {
  throw new Error(
    `Invalid SOLANA_WALLET_PRIVATE_KEY: ${
      error instanceof Error
        ? error.message
        : String(error)
    }`,
  );
}

const payer =
  Keypair.fromSecretKey(secretKey);

console.log(
  "💰 Wallet:",
  payer.publicKey.toBase58(),
);

// ============================================================
// HASH GENERATION
// ============================================================

const generateAttendanceHash = (
  studentId: string,
  sessionId: string,
  timestamp: number,
  deviceId: string,
): Buffer => {
  const data =
    `${studentId}:${sessionId}:${timestamp}:${deviceId}`;

  return crypto
    .createHash("sha256")
    .update(data)
    .digest();
};

// ============================================================
// PDA SEED
// ============================================================
//
// IMPORTANT:
//
// Solana allows a maximum of 32 bytes PER seed.
//
// Your old implementation used:
//
//   Buffer.from(recordId)
//
// But:
//
//   test-student-001-test-session-001
//
// is longer than 32 bytes.
//
// Therefore BOTH the client and Rust program must use:
//
//   sha256(recordId)
//
// as the second PDA seed.
//
// PDA:
//
//   ["attendance", sha256(recordId)]
//
// ============================================================

const createAttendancePDASeed = (
  recordId: string,
): Buffer => {
  const seed =
    crypto
      .createHash("sha256")
      .update(recordId, "utf8")
      .digest();

  if (seed.length !== 32) {
    throw new Error(
      `Invalid PDA seed length: ${seed.length}`,
    );
  }

  return seed;
};

// ============================================================
// GET ATTENDANCE PDA
// ============================================================

const getAttendancePDA = (
  recordId: string,
): [PublicKey, number] => {
  const hashedRecordId =
    createAttendancePDASeed(recordId);

  console.log(
    "🔑 PDA recordId:",
    recordId,
  );

  console.log(
    "🔑 PDA hashed seed:",
    hashedRecordId.toString("hex"),
  );

  console.log(
    "🔑 PDA seed lengths:",
    {
      attendance: Buffer.byteLength(
        "attendance",
      ),
      recordHash: hashedRecordId.length,
    },
  );

  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("attendance"),
      hashedRecordId,
    ],
    programId,
  );
};

// ============================================================
// BUFFER -> [u8; 32]
// ============================================================

const bufferTo32Array = (
  buffer: Buffer,
): number[] => {
  if (buffer.length !== 32) {
    throw new Error(
      `Hash must be exactly 32 bytes. Got ${buffer.length}`,
    );
  }

  return Array.from(buffer);
};

// ============================================================
// ANCHOR INSTRUCTION DISCRIMINATOR
// ============================================================
//
// IMPORTANT:
//
// Rust function:
//
//   pub fn record_attendance(...)
//
// Anchor instruction discriminator:
//
//   sha256("global:record_attendance")[0..8]
//
// ============================================================

const createInstructionDiscriminator = (
  methodName: string,
): Buffer => {
  return crypto
    .createHash("sha256")
    .update(`global:${methodName}`)
    .digest()
    .subarray(0, 8);
};

// ============================================================
// ENCODING HELPERS
// ============================================================

const encodeU32 = (
  value: number,
): Buffer => {
  const buffer =
    Buffer.alloc(4);

  buffer.writeUInt32LE(
    value,
    0,
  );

  return buffer;
};

const encodeString = (
  value: string,
): Buffer => {
  const text =
    Buffer.from(value, "utf8");

  return Buffer.concat([
    encodeU32(text.length),
    text,
  ]);
};

const encodeI64 = (
  value: number | bigint,
): Buffer => {
  const buffer =
    Buffer.alloc(8);

  buffer.writeBigInt64LE(
    BigInt(value),
    0,
  );

  return buffer;
};

// ============================================================
// SERIALIZE RECORD ATTENDANCE ARGUMENTS
// ============================================================

const serializeRecordAttendanceArgs = (
  recordId: string,
  hashArray: number[],
  timestamp: number,
  deviceId: string,
): Buffer => {
  return Buffer.concat([
    encodeString(recordId),

    Buffer.from(hashArray),

    encodeI64(timestamp),

    encodeString(deviceId),
  ]);
};

// ============================================================
// SERIALIZE VERIFY INTEGRITY ARGUMENTS
// ============================================================

const serializeVerifyIntegrityArgs = (
  hashArray: number[],
): Buffer => {
  return Buffer.from(hashArray);
};

// ============================================================
// DECODE STRING
// ============================================================

const decodeString = (
  data: Buffer,
  offset: number,
): [string, number] => {
  if (
    offset + 4 >
    data.length
  ) {
    throw new Error(
      "Invalid account data: unable to read string length",
    );
  }

  const length =
    data.readUInt32LE(offset);

  const start =
    offset + 4;

  const end =
    start + length;

  if (end > data.length) {
    throw new Error(
      "Invalid account data: string exceeds account size",
    );
  }

  return [
    data
      .subarray(start, end)
      .toString("utf8"),
    end,
  ];
};

// ============================================================
// DECODE ATTENDANCE RECORD
// ============================================================

const decodeAttendanceRecord = (
  data: Buffer,
): {
  recordId: string;
  hash: number[];
  timestamp: number;
  deviceId: string;
  bump: number;
} => {
  let offset = 0;

  // ----------------------------------------------------------
  // Anchor account discriminator
  // ----------------------------------------------------------
  //
  // The first 8 bytes belong to Anchor's account discriminator.
  //
  // IMPORTANT:
  // We MUST skip these 8 bytes before decoding fields.
  //
  // ----------------------------------------------------------

  if (data.length < 8) {
    throw new Error(
      "Invalid AttendanceRecord account data",
    );
  }

  offset = 8;

  // ----------------------------------------------------------
  // recordId
  // ----------------------------------------------------------

  const [
    recordId,
    afterRecordId,
  ] =
    decodeString(
      data,
      offset,
    );

  offset =
    afterRecordId;

  // ----------------------------------------------------------
  // hash
  // ----------------------------------------------------------

  if (
    offset + 32 >
    data.length
  ) {
    throw new Error(
      "Invalid AttendanceRecord hash data",
    );
  }

  const hash =
    Array.from(
      data.subarray(
        offset,
        offset + 32,
      ),
    );

  offset += 32;

  // ----------------------------------------------------------
  // timestamp
  // ----------------------------------------------------------

  if (
    offset + 8 >
    data.length
  ) {
    throw new Error(
      "Invalid AttendanceRecord timestamp",
    );
  }

  const timestamp =
    Number(
      data.readBigInt64LE(
        offset,
      ),
    );

  offset += 8;

  // ----------------------------------------------------------
  // deviceId
  // ----------------------------------------------------------

  const [
    deviceId,
    afterDeviceId,
  ] =
    decodeString(
      data,
      offset,
    );

  offset =
    afterDeviceId;

  // ----------------------------------------------------------
  // bump
  // ----------------------------------------------------------

  if (
    offset >= data.length
  ) {
    throw new Error(
      "Invalid AttendanceRecord bump",
    );
  }

  const bump =
    data.readUInt8(offset);

  return {
    recordId,
    hash,
    timestamp,
    deviceId,
    bump,
  };
};

// ============================================================
// BUILD RECORD ATTENDANCE INSTRUCTION
// ============================================================

const buildRecordAttendanceInstruction = (
  recordPDA: PublicKey,
  recordId: string,
  hashArray: number[],
  timestamp: number,
  deviceId: string,
): TransactionInstruction => {

  // ----------------------------------------------------------
  // Anchor discriminator
  // ----------------------------------------------------------

  const discriminator =
    createInstructionDiscriminator(
      "record_attendance",
    );

  console.log(
    "========================================",
  );

  console.log(
    "🔑 ANCHOR INSTRUCTION",
  );

  console.log(
    "Instruction: record_attendance",
  );

  console.log(
    "Discriminator:",
    discriminator.toString("hex"),
  );

  console.log(
    "Expected:",
    "4f57601819a910c9",
  );

  console.log(
    "========================================",
  );

  // ----------------------------------------------------------
  // Instruction data
  // ----------------------------------------------------------

  const args =
    serializeRecordAttendanceArgs(
      recordId,
      hashArray,
      timestamp,
      deviceId,
    );

  const data =
    Buffer.concat([
      discriminator,
      args,
    ]);

  console.log(
    "Instruction data length:",
    data.length,
  );

  // ----------------------------------------------------------
  // Accounts
  // ----------------------------------------------------------

  console.log(
    "Instruction accounts:",
  );

  console.log(
    "record:",
    recordPDA.toBase58(),
  );

  console.log(
    "authority:",
    payer.publicKey.toBase58(),
  );

  console.log(
    "systemProgram:",
    SystemProgram.programId.toBase58(),
  );

  return new TransactionInstruction({
    keys: [
      {
        pubkey: recordPDA,
        isSigner: false,
        isWritable: true,
      },

      {
        pubkey: payer.publicKey,
        isSigner: true,
        isWritable: true,
      },

      {
        pubkey:
          SystemProgram.programId,
        isSigner: false,
        isWritable: false,
      },
    ],

    programId,

    data,
  });
};

// ============================================================
// BUILD VERIFY INTEGRITY INSTRUCTION
// ============================================================

const buildVerifyIntegrityInstruction = (
  recordPDA: PublicKey,
  hashArray: number[],
): TransactionInstruction => {

  const discriminator =
    createInstructionDiscriminator(
      "verify_integrity",
    );

  const data =
    Buffer.concat([
      discriminator,
      serializeVerifyIntegrityArgs(
        hashArray,
      ),
    ]);

  return new TransactionInstruction({
    keys: [
      {
        pubkey: recordPDA,
        isSigner: false,
        isWritable: false,
      },
    ],

    programId,

    data,
  });
};

// ============================================================
// GATEWAY
// ============================================================

export const SolanaBlockchainGateway = {

  // ==========================================================
  // RECORD ATTENDANCE
  // ==========================================================

  recordAttendanceHash:
    async (
      studentId: string,
      sessionId: string,
      deviceId: string = "default",
    ): Promise<string> => {

      console.log(
        "========================================",
      );

      console.log(
        "⛓️ [Solana] Starting attendance blockchain record...",
      );

      console.log(
        "========================================",
      );

      // --------------------------------------------------------
      // Timestamp
      // --------------------------------------------------------

      const timestamp =
        Math.floor(
          Date.now() / 1000,
        );

      // --------------------------------------------------------
      // Record ID
      // --------------------------------------------------------

      const recordId =
        `${studentId}-${sessionId}`;

      console.log(
        "Student ID:",
        studentId,
      );

      console.log(
        "Session ID:",
        sessionId,
      );

      console.log(
        "Record ID:",
        recordId,
      );

      console.log(
        "Record ID byte length:",
        Buffer.byteLength(
          recordId,
          "utf8",
        ),
      );

      console.log(
        "Timestamp:",
        timestamp,
      );

      console.log(
        "Device ID:",
        deviceId,
      );

      // --------------------------------------------------------
      // Generate attendance hash
      // --------------------------------------------------------

      const hash =
        generateAttendanceHash(
          studentId,
          sessionId,
          timestamp,
          deviceId,
        );

      const hashArray =
        bufferTo32Array(hash);

      console.log(
        "Attendance hash:",
        hash.toString("hex"),
      );

      // --------------------------------------------------------
      // Derive PDA
      // --------------------------------------------------------

      const [
        recordPDA,
        bump,
      ] =
        getAttendancePDA(
          recordId,
        );

      console.log(
        "Attendance PDA:",
        recordPDA.toBase58(),
      );

      console.log(
        "PDA bump:",
        bump,
      );

      // --------------------------------------------------------
      // Build instruction
      // --------------------------------------------------------

      const instruction =
        buildRecordAttendanceInstruction(
          recordPDA,
          recordId,
          hashArray,
          timestamp,
          deviceId,
        );

      console.log(
        "✅ Solana instruction created",
      );

      // --------------------------------------------------------
      // Build transaction
      // --------------------------------------------------------

      const tx =
        new Transaction().add(
          instruction,
        );

      tx.feePayer =
        payer.publicKey;

      console.log(
        "Fee payer:",
        payer.publicKey.toBase58(),
      );

      // --------------------------------------------------------
      // Latest blockhash
      // --------------------------------------------------------

      const latestBlockhash =
        await connection.getLatestBlockhash(
          "confirmed",
        );

      console.log(
        "Latest blockhash:",
        latestBlockhash.blockhash,
      );

      // --------------------------------------------------------
      // Sign transaction
      // --------------------------------------------------------

      tx.recentBlockhash =
        latestBlockhash.blockhash;

      tx.sign(payer);

      console.log(
        "✅ Transaction signed",
      );

      // --------------------------------------------------------
      // Send transaction
      // --------------------------------------------------------

      try {

        const signature =
          await connection.sendRawTransaction(
            tx.serialize(),
            {
              skipPreflight: false,
            },
          );

        console.log(
          "🚀 Transaction submitted:",
          signature,
        );

        // ------------------------------------------------------
        // Confirm
        // ------------------------------------------------------

        await connection.confirmTransaction(
          {
            signature,

            blockhash:
              latestBlockhash.blockhash,

            lastValidBlockHeight:
              latestBlockhash.lastValidBlockHeight,
          },
          "confirmed",
        );

        console.log(
          "✅ Attendance recorded on Solana:",
          signature,
        );

        return signature;

      } catch (error) {

        console.error(
          "❌ Solana transaction failed",
        );

        if (
          error instanceof SendTransactionError
        ) {
          console.error(
            "Transaction logs:",
            error.logs,
          );
        }

        console.error(
          error,
        );

        throw error;
      }
    },

  // ==========================================================
  // VERIFY ATTENDANCE
  // ==========================================================

  verifyAttendanceHash:
    async (
      studentId: string,
      sessionId: string,
      deviceId?: string,
    ): Promise<boolean> => {

      try {

        console.log(
          "========================================",
        );

        console.log(
          "🔐 [Solana] Verifying attendance...",
        );

        console.log(
          "========================================",
        );

        const recordId =
          `${studentId}-${sessionId}`;

        console.log(
          "Record ID:",
          recordId,
        );

        // ------------------------------------------------------
        // Same PDA derivation
        // ------------------------------------------------------

        const [
          recordPDA,
        ] =
          getAttendancePDA(
            recordId,
          );

        console.log(
          "Attendance PDA:",
          recordPDA.toBase58(),
        );

        // ------------------------------------------------------
        // Fetch account
        // ------------------------------------------------------

        const accountInfo =
          await connection.getAccountInfo(
            recordPDA,
          );

        if (!accountInfo) {

          console.log(
            "❌ Attendance PDA does not exist",
          );

          return false;
        }

        console.log(
          "✅ Attendance PDA found",
        );

        console.log(
          "Account owner:",
          accountInfo.owner.toBase58(),
        );

        console.log(
          "Account data length:",
          accountInfo.data.length,
        );

        // ------------------------------------------------------
        // Decode
        // ------------------------------------------------------

        const record =
          decodeAttendanceRecord(
            accountInfo.data,
          );

        const storedDeviceId =
          deviceId ||
          record.deviceId;

        const timestamp =
          Number(record.timestamp);

        // ------------------------------------------------------
        // Generate expected hash
        // ------------------------------------------------------

        const expectedHash =
          generateAttendanceHash(
            studentId,
            sessionId,
            timestamp,
            storedDeviceId,
          );

        const currentHash =
          Buffer.from(
            record.hash,
          ).toString("hex");

        const expectedHashHex =
          expectedHash.toString(
            "hex",
          );

        const verified =
          currentHash ===
          expectedHashHex;

        console.log(
          "Stored hash:",
          currentHash,
        );

        console.log(
          "Expected hash:",
          expectedHashHex,
        );

        console.log(
          "🔐 Verification result:",
          verified,
        );

        return verified;

      } catch (error) {

        console.error(
          "❌ Error verifying attendance:",
          error,
        );

        return false;
      }
    },

  // ==========================================================
  // GET ATTENDANCE RECORD
  // ==========================================================

  getAttendanceRecord:
    async (
      studentId: string,
      sessionId: string,
    ): Promise<any> => {

      try {

        console.log(
          "========================================",
        );

        console.log(
          "📦 [Solana] Fetching attendance record...",
        );

        console.log(
          "========================================",
        );

        const recordId =
          `${studentId}-${sessionId}`;

        console.log(
          "Record ID:",
          recordId,
        );

        // ------------------------------------------------------
        // Same PDA derivation
        // ------------------------------------------------------

        const [
          recordPDA,
        ] =
          getAttendancePDA(
            recordId,
          );

        console.log(
          "Attendance PDA:",
          recordPDA.toBase58(),
        );

        // ------------------------------------------------------
        // Fetch account
        // ------------------------------------------------------

        const accountInfo =
          await connection.getAccountInfo(
            recordPDA,
          );

        if (!accountInfo) {

          console.log(
            "❌ Attendance record not found",
          );

          return null;
        }

        console.log(
          "✅ Attendance account found",
        );

        console.log(
          "Account owner:",
          accountInfo.owner.toBase58(),
        );

        console.log(
          "Account data length:",
          accountInfo.data.length,
        );

        // ------------------------------------------------------
        // Decode
        // ------------------------------------------------------

        const record =
          decodeAttendanceRecord(
            accountInfo.data,
          );

        console.log(
          "Decoded blockchain record:",
          record,
        );

        return {

          recordId:
            record.recordId,

          hash:
            Buffer.from(
              record.hash,
            ).toString("hex"),

          timestamp:
            Number(
              record.timestamp,
            ),

          deviceId:
            record.deviceId,

          bump:
            record.bump,

          pda:
            recordPDA.toBase58(),
        };

      } catch (error) {

        console.error(
          "❌ Error fetching attendance record:",
          error,
        );

        return null;
      }
    },
};
