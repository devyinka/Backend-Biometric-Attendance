import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';

import * as crypto from 'crypto';


// ============================================================
// ENVIRONMENT VARIABLES
// ============================================================

const rpcUrl =
  process.env.SOLANA_RPC_URL ||
  'https://api.devnet.solana.com';

const programIdString = process.env.SOLANA_PROGRAM_ID;
const walletPrivateKey = process.env.SOLANA_WALLET_PRIVATE_KEY;


// ============================================================
// ENVIRONMENT VALIDATION
// ============================================================

if (!programIdString) {
  throw new Error(
    'Missing SOLANA_PROGRAM_ID in environment',
  );
}

if (!walletPrivateKey) {
  throw new Error(
    'Missing SOLANA_WALLET_PRIVATE_KEY in environment',
  );
}


// ============================================================
// SOLANA CONNECTION
// ============================================================

const connection = new Connection(
  rpcUrl,
  'confirmed',
);


// ============================================================
// PROGRAM ID
// ============================================================

const programId = new PublicKey(
  programIdString,
);


// ============================================================
// WALLET / PAYER
// ============================================================

let secretKey: Uint8Array;

try {
  const parsedKey = JSON.parse(walletPrivateKey);

  if (!Array.isArray(parsedKey)) {
    throw new Error(
      'SOLANA_WALLET_PRIVATE_KEY must be a JSON array',
    );
  }

  if (parsedKey.length !== 64) {
    throw new Error(
      `Invalid Solana secret key size. Expected 64 bytes, got ${parsedKey.length}`,
    );
  }

  secretKey = Uint8Array.from(parsedKey);
} catch (error) {
  throw new Error(
    `Invalid SOLANA_WALLET_PRIVATE_KEY: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
}

const payer = Keypair.fromSecretKey(
  secretKey,
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
    .createHash('sha256')
    .update(data)
    .digest();
};


// ============================================================
// BUFFER -> [u8; 32]
// ============================================================

const bufferTo32Array = (
  buffer: Buffer,
): number[] => {
  if (buffer.length !== 32) {
    throw new Error(
      'Hash must be exactly 32 bytes',
    );
  }

  return Array.from(buffer);
};


// ============================================================
// ANCHOR-LIKE DISCRIMINATOR FOR INSTRUCTION DATA
// ============================================================
//
// Anchor uses the first 8 bytes of sha256("global:<method_name>")
// as the instruction discriminator. This lets us avoid the IDL
// parsing entirely and build raw transactions by hand.
// ============================================================

const createInstructionDiscriminator = (
  methodName: string,
): Buffer => {
  return crypto
    .createHash('sha256')
    .update(`global:${methodName}`)
    .digest()
    .subarray(0, 8);
};


const encodeU32 = (
  value: number,
): Buffer => {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value, 0);
  return buffer;
};

const encodeString = (
  value: string,
): Buffer => {
  const text = Buffer.from(value, 'utf8');
  return Buffer.concat([
    encodeU32(text.length),
    text,
  ]);
};

const encodeI64 = (
  value: number | bigint,
): Buffer => {
  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64LE(BigInt(value), 0);
  return buffer;
};

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

const serializeVerifyIntegrityArgs = (
  hashArray: number[],
): Buffer => {
  return Buffer.from(hashArray);
};


const decodeString = (
  data: Buffer,
  offset: number,
): [string, number] => {
  const length = data.readUInt32LE(offset);
  const start = offset + 4;
  const end = start + length;
  return [
    data.subarray(start, end).toString('utf8'),
    end,
  ];
};

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

  const [recordId, afterRecordId] = decodeString(data, offset);
  offset = afterRecordId;

  const hash = Array.from(data.subarray(offset, offset + 32));
  offset += 32;

  const timestamp = Number(data.readBigInt64LE(offset));
  offset += 8;

  const [deviceId, afterDeviceId] = decodeString(data, offset);
  offset = afterDeviceId;

  const bump = data.readUInt8(offset);

  return {
    recordId,
    hash,
    timestamp,
    deviceId,
    bump,
  };
};

const buildRecordAttendanceInstruction = (
  recordPDA: PublicKey,
  recordId: string,
  hashArray: number[],
  timestamp: number,
  deviceId: string,
): TransactionInstruction => {
  const discriminator = createInstructionDiscriminator('recordAttendance');
  const data = Buffer.concat([
    discriminator,
    serializeRecordAttendanceArgs(
      recordId,
      hashArray,
      timestamp,
      deviceId,
    ),
  ]);

  return new TransactionInstruction({
    keys: [
      { pubkey: recordPDA, isSigner: false, isWritable: true },
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId,
    data,
  });
};

const buildVerifyIntegrityInstruction = (
  recordPDA: PublicKey,
  hashArray: number[],
): TransactionInstruction => {
  const discriminator = createInstructionDiscriminator('verifyIntegrity');
  const data = Buffer.concat([
    discriminator,
    serializeVerifyIntegrityArgs(hashArray),
  ]);

  return new TransactionInstruction({
    keys: [
      { pubkey: recordPDA, isSigner: false, isWritable: false },
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

  recordAttendanceHash: async (
    studentId: string,
    sessionId: string,
    deviceId: string = 'default',
  ): Promise<string> => {
    const timestamp = Math.floor(Date.now() / 1000);
    const recordId = `${studentId}-${sessionId}`;

    const hash = generateAttendanceHash(
      studentId,
      sessionId,
      timestamp,
      deviceId,
    );

    const hashArray = bufferTo32Array(hash);

    const [recordPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('attendance'),
        Buffer.from(recordId),
      ],
      programId,
    );

    const instruction = buildRecordAttendanceInstruction(
      recordPDA,
      recordId,
      hashArray,
      timestamp,
      deviceId,
    );

    const tx = new Transaction().add(instruction);
    tx.feePayer = payer.publicKey;

    const latestBlockhash = await connection.getLatestBlockhash('confirmed');
    tx.recentBlockhash = latestBlockhash.blockhash;
    tx.sign(payer);

    const signature = await connection.sendRawTransaction(
      tx.serialize(),
      { skipPreflight: false },
    );

    await connection.confirmTransaction(
      {
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      },
      'confirmed',
    );

    console.log('✅ Attendance recorded on Solana:', signature);
    return signature;
  },


  // ==========================================================
  // VERIFY ATTENDANCE
  // ==========================================================

  verifyAttendanceHash: async (
    studentId: string,
    sessionId: string,
    deviceId?: string,
  ): Promise<boolean> => {
    try {
      const recordId = `${studentId}-${sessionId}`;
      const [recordPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('attendance'),
          Buffer.from(recordId),
        ],
        programId,
      );

      const accountInfo = await connection.getAccountInfo(recordPDA);

      if (!accountInfo) {
        return false;
      }

      const record = decodeAttendanceRecord(accountInfo.data);
      const storedDeviceId = deviceId || record.deviceId;
      const timestamp = Number(record.timestamp);

      const expectedHash = generateAttendanceHash(
        studentId,
        sessionId,
        timestamp,
        storedDeviceId,
      );

      const expectedArray = bufferTo32Array(expectedHash);
      const currentHash = Buffer.from(record.hash).toString('hex');
      const expectedHashHex = Buffer.from(expectedArray).toString('hex');

      return currentHash === expectedHashHex;
    } catch (error) {
      console.error('❌ Error verifying attendance:', error);
      return false;
    }
  },


  // ==========================================================
  // GET ATTENDANCE RECORD
  // ==========================================================

  getAttendanceRecord: async (
    studentId: string,
    sessionId: string,
  ): Promise<any> => {
    try {
      const recordId = `${studentId}-${sessionId}`;
      const [recordPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('attendance'),
          Buffer.from(recordId),
        ],
        programId,
      );

      const accountInfo = await connection.getAccountInfo(recordPDA);

      if (!accountInfo) {
        return null;
      }

      const record = decodeAttendanceRecord(accountInfo.data);

      return {
        recordId: record.recordId,
        hash: Buffer.from(record.hash).toString('hex'),
        timestamp: Number(record.timestamp),
        deviceId: record.deviceId,
        bump: record.bump,
        pda: recordPDA.toBase58(),
      };
    } catch (error) {
      console.error('❌ Error fetching attendance record:', error);
      return null;
    }
  },
};