import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { AnchorProvider, Program } from '@coral-xyz/anchor';
import IDL from '../models/attendance_ledger.json';
import * as crypto from 'crypto';

const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const programIdString = process.env.SOLANA_PROGRAM_ID;
const walletPrivateKey = process.env.SOLANA_WALLET_PRIVATE_KEY;

if (!programIdString) {
  throw new Error('Missing SOLANA_PROGRAM_ID in environment');
}
if (!walletPrivateKey) {
  throw new Error('Missing SOLANA_WALLET_PRIVATE_KEY in environment');
}

const connection = new Connection(rpcUrl, 'confirmed');
const programId = new PublicKey(programIdString);
const payer = Keypair.fromSecretKey(Uint8Array.from(Buffer.from(walletPrivateKey, 'base64')));

const getProvider = (): AnchorProvider => {
  const wallet = {
    publicKey: payer.publicKey,
    signTransaction: async (transaction: Transaction) => {
      transaction.partialSign(payer);
      return transaction;
    },
    signAllTransactions: async (transactions: Transaction[]) => {
      transactions.forEach((transaction) => transaction.partialSign(payer));
      return transactions;
    },
  } as any;

  return new AnchorProvider(connection, wallet, AnchorProvider.defaultOptions());
};

const program = new Program(IDL as any, programId, getProvider());

/**
 * Generate a SHA-256 hash of attendance record data
 * This hash is what gets stored on the blockchain for verification
 */
const generateAttendanceHash = (
  studentId: string,
  sessionId: string,
  timestamp: number,
  deviceId: string,
): Buffer => {
  const data = `${studentId}:${sessionId}:${timestamp}:${deviceId}`;
  return crypto.createHash('sha256').update(data).digest();
};

/**
 * Convert Buffer to [u8; 32] array for Solana
 */
const bufferTo32Array = (buffer: Buffer): number[] => {
  if (buffer.length !== 32) {
    throw new Error('Hash must be exactly 32 bytes');
  }
  return Array.from(buffer);
};

export const SolanaBlockchainGateway = {
  /**
   * Record attendance hash on Solana blockchain for verification
   * This stores a hash, not the actual attendance data
   */
  recordAttendanceHash: async (
    studentId: string,
    sessionId: string,
    deviceId: string = 'default',
  ): Promise<string> => {
    const timestamp = Math.floor(Date.now() / 1000);
    const recordId = `${studentId}-${sessionId}`;
    const hash = generateAttendanceHash(studentId, sessionId, timestamp, deviceId);
    const hashArray = bufferTo32Array(hash);

    const [recordPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('attendance'), Buffer.from(recordId)],
      programId,
    );

    const tx = await program.methods
      .recordAttendance(recordId, hashArray, BigInt(timestamp), deviceId)
      .accounts({
        record: recordPDA,
        authority: payer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return tx;
  },

  /**
   * Verify an attendance record by checking on-chain integrity
   */
  verifyAttendanceHash: async (
    studentId: string,
    sessionId: string,
    deviceId?: string,
  ): Promise<boolean> => {
    try {
      const recordId = `${studentId}-${sessionId}`;
      const [recordPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('attendance'), Buffer.from(recordId)],
        programId,
      );

      const record = await program.account.attendanceRecord.fetch(recordPDA);
      const device = deviceId || record.deviceId;
      const timestamp = Number(record.timestamp);

      const expectedHash = generateAttendanceHash(studentId, sessionId, timestamp, device);
      const hashArray = bufferTo32Array(expectedHash);

      const isVerified = await program.methods
        .verifyIntegrity(hashArray)
        .accounts({
          record: recordPDA,
        })
        .view();

      return isVerified;
    } catch (error) {
      console.error('❌ Error verifying attendance:', error);
      return false;
    }
  },

  /**
   * Get the on-chain record details
   */
  getAttendanceRecord: async (studentId: string, sessionId: string): Promise<any> => {
    try {
      const recordId = `${studentId}-${sessionId}`;
      const [recordPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('attendance'), Buffer.from(recordId)],
        programId,
      );

      const record = await program.account.attendanceRecord.fetch(recordPDA);

      return {
        recordId: record.recordId || record.record_id,
        hash: Buffer.from(record.hash).toString('hex'),
        timestamp: Number(record.timestamp),
        deviceId: record.deviceId || record.device_id,
        bump: record.bump,
        pda: recordPDA.toBase58(),
      };
    } catch (error) {
      console.error('❌ Error fetching attendance record:', error);
      return null;
    }
  },
};
