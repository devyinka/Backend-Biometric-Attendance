# 🚀 Integration Checklist: Solana Anchor for Attendance Verification

## 📋 Quick Overview

Your attendance system currently:

- ✅ Records attendance in database (primary storage)
- ❌ Uses Hyperledger Fabric for blockchain (expensive, complex)
- ❌ Stores full transaction logs on-chain

**What we're changing:**

- ✅ Keep database as primary storage (fast, scalable)
- ✅ Use Solana Anchor ONLY for verification hashes (cheap, simple)
- ✅ Store immutable proof of attendance records

---

## 🔄 Integration Steps

### Step 1: Install Solana Dependencies ⭐

```bash
npm install @solana/web3.js @coral-xyz/anchor @solana/spl-token
```

Update your `package.json` to include:

```json
{
  "dependencies": {
    "@solana/web3.js": "^1.91.0",
    "@coral-xyz/anchor": "^0.30.0",
    "@supabase/supabase-js": "^2.107.0",
    "@tensorflow/tfjs-node": "^4.22.0",
    "@vladmandic/face-api": "^1.7.15",
    "compression": "^1.8.1",
    "cookie-parser": "^1.4.7",
    "cors": "^2.8.6",
    "dotenv": "^17.4.2",
    "express": "^5.2.1",
    "helmet": "^8.2.0",
    "morgan": "^1.11.0",
    "mqtt": "^5.15.1",
    "multer": "^2.1.1",
    "socket.io": "^4.8.3"
  }
}
```

### Step 2: Add Environment Variables

Create/update your `.env` file:

```env
# Solana Configuration
SOLANA_RPC_URL=https://api.devnet.solana.com
# Your Anchor program ID (from your Rust deploy)
SOLANA_PROGRAM_ID=5B7Vf6h3MikSQNWpHtyMu5UNMA233MboaMGK837gxhph
# Base64-encoded private key of wallet that pays for transactions
SOLANA_WALLET_PRIVATE_KEY=your_base64_encoded_private_key_here

# Existing variables
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
HLF_PEER_ENDPOINT=your_hyperledger_endpoint (can remove if not needed)
HLF_CHANNEL_NAME=your_channel
HLF_CHAINCODE_NAME=your_chaincode
```

### Step 3: Export Your Anchor IDL

From your Anchor project:

```bash
# In your Anchor project directory
cd attendance_ledger
cat target/idl/attendance_ledger.json > /path/to/backend/models/attendance_ledger.json
```

Or manually create it at `models/attendance_ledger.json`:

```json
{
  "version": "0.1.0",
  "name": "attendance_ledger",
  "instructions": [
    {
      "name": "recordAttendance",
      "accounts": [...],
      "args": [...]
    },
    {
      "name": "verifyIntegrity",
      "accounts": [...],
      "args": [...]
    }
  ],
  "accounts": [...],
  "events": [],
  "errors": []
}
```

### Step 4: Copy New Gateway File

We've created `gateWay/solanaBlockchainGateway.ts` for you.

- Copy this file to your project: `gateWay/solanaBlockchainGateway.ts`

### Step 5: Update attendanceService.ts

**Option A: Replace entire file** (Safe, recommended)

```bash
cp services/attendanceService.UPDATED.ts services/attendanceService.ts
```

**Option B: Manual changes**

Find these lines and replace:

**Line 2:**

```typescript
// OLD
import { BlockchainGateway } from '../gateWay/blockChainGateWay';

// NEW
import { SolanaBlockchainGateway } from '../gateWay/solanaBlockchainGateway';
```

**Line 35-38 (markLiveAttendance):**

```typescript
// OLD
const txHash = await BlockchainGateway.recordAttendance(student.student_id, session.id);

// NEW
const txHash = await SolanaBlockchainGateway.recordAttendanceHash(
  student.student_id,
  session.id,
  'face_and_fingerprint',
);
```

**Line 116-120 (markOfflineAttendance):**

```typescript
// OLD
const txHash = await BlockchainGateway.recordAttendance(student.student_id, targetSession.id);

// NEW
const txHash = await SolanaBlockchainGateway.recordAttendanceHash(
  student.student_id,
  targetSession.id,
  'fingerprint_offline',
);
```

### Step 6: Add Verification to History Endpoint

Add this at the end of `getAttendanceHistory` before returning:

```typescript
// 🔐 Add blockchain verification status
const enhancedRecords = await Promise.all(
  data.map(async (record: any) => {
    try {
      const isVerified = await SolanaBlockchainGateway.verifyAttendanceHash(
        record.student_id,
        record.session_id,
      );
      return {
        ...record,
        blockchainVerified: isVerified,
        blockchainTx: record.tx_hash,
      };
    } catch (err) {
      return {
        ...record,
        blockchainVerified: false,
        blockchainTx: record.tx_hash,
      };
    }
  }),
);

return {
  records: enhancedRecords,  // Changed from 'data' to 'enhancedRecords'
  pagination: { ... }
};
```

### Step 7: Test the Integration

```bash
# Build TypeScript
npm run build

# Start development server
npm run dev
```

Test endpoints:

```bash
# Mark live attendance
curl -X POST http://localhost:5000/mark-live \
  -F "fingerPrintSlot=5" \
  -F "courseId=CS-101" \
  -F "face=@face.jpg"

# Expected response:
# {
#   "status": "success",
#   "message": "Attendance marked for John Doe",
#   "txHash": "5vY8K2mN...",
#   "blockchainVerification": "Hash recorded on Solana"
# }

# Get history with verification
curl -X GET http://localhost:5000/history \
  -H "Authorization: Bearer your_token" \
  -d {
    "courseId": "CS-101",
    "month": 8,
    "year": 2024,
    "userId": "user-123"
  }

# Response will include:
# {
#   "records": [
#     {
#       "id": "...",
#       "student_id": "STU-042",
#       "tx_hash": "5vY8K2mN...",
#       "blockchainVerified": true,  ✅ NEW
#       "blockchainTx": "5vY8K2mN...",  ✅ NEW
#       ...
#     }
#   ]
# }
```

---

## ⚙️ Configuration Details

### Understanding the Hash Generation

```typescript
// In solanaBlockchainGateway.ts
const generateAttendanceHash = (
  studentId: string, // "STU-0042"
  sessionId: string, // "SESSION-789"
  timestamp: number, // Unix timestamp
  deviceId: string, // "face_and_fingerprint" or "fingerprint_offline"
): Buffer => {
  // Creates deterministic hash from these 4 values
  const data = `${studentId}:${sessionId}:${timestamp}:${deviceId}`;
  return crypto.createHash('sha256').update(data).digest();
};
```

This hash is what gets stored on Solana, ensuring:

- ✅ Can't tamper with attendance data
- ✅ Can't fake attendance records
- ✅ Audit trail is immutable

### PDA (Program Derived Address) Derivation

```typescript
// Seeds determine the PDA for each attendance record
const [recordPDA] = PublicKey.findProgramAddressSync(
  [
    Buffer.from('attendance'),
    Buffer.from(recordId), // "STU-0042-SESSION-789"
  ],
  programId,
);
```

Same inputs = Same PDA, so verification always finds the record.

---

## 🔄 Optional: Fallback for Blockchain Errors

The updated `attendanceService.ts` includes error handling:

```typescript
try {
  const txHash = await SolanaBlockchainGateway.recordAttendanceHash(...);
} catch (blockchainError) {
  // Still save to DB, but mark as pending
  await Database.from("attendance_logs").insert({
    student_id: student.student_id,
    session_id: targetSession.id,
    tx_hash: null,
    status: "pending_blockchain",
  });
}
```

Later, sync pending records:

```typescript
await Attendance.syncPendingBlockchainRecords();
```

---

## 🎯 What Changes in Behavior

| Feature                  | Before (Hyperledger)      | After (Solana)                    |
| ------------------------ | ------------------------- | --------------------------------- |
| **Transaction Cost**     | High (complex setup)      | Low (~0.00001 SOL per attendance) |
| **Speed**                | ~5-10s                    | ~15-30s (network dependent)       |
| **Data Stored On-Chain** | Full attendance record    | Only SHA256 hash                  |
| **Verification**         | Complex chaincode queries | Simple hash comparison            |
| **Scalability**          | Limited                   | Unlimited (Solana capacity)       |
| **Cost at Scale**        | Increases rapidly         | Linear (very cheap)               |

---

## ✅ Verification: How It Works

### Recording (POST /mark-live or /mark-offline)

```
1. Student marked -> Generate SHA256 hash
2. Call Anchor: recordAttendance(hash)
3. Hash stored in PDA on blockchain
4. tx_signature returned -> saved in DB
```

### Verification (GET /history)

```
1. Fetch attendance from DB
2. For each record:
   a. Regenerate SHA256(studentId:sessionId:timestamp:deviceId)
   b. Fetch on-chain record via PDA
   c. Compare: expectedHash === blockchainHash
   d. If match -> blockchainVerified: true ✅
```

---

## 🐛 Troubleshooting

### Issue: "Connection timeout"

```
Solution: Check SOLANA_RPC_URL is accessible
npm run test-solana  # Will add a test script
```

### Issue: "Insufficient SOL in wallet"

```
Solution: Fund your wallet from Solana faucet
solana airdrop 2 <YOUR_WALLET_ADDRESS>
```

### Issue: "Invalid program IDL"

```
Solution: Make sure models/attendance_ledger.json matches your deployed program
Re-export from Anchor: anchor idl fetch <PROGRAM_ID> > models/attendance_ledger.json
```

### Issue: "Verification returning false"

```
Possible causes:
1. Device ID mismatch - ensure same device_id used for recording
2. Timestamp differences - clock skew
3. PDA derivation - verify seeds match exactly
```

---

## 📊 Database Schema Update (Optional)

Consider adding these columns to `attendance_logs`:

```sql
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS (
  blockchain_verified BOOLEAN DEFAULT FALSE,
  blockchain_error_message TEXT,
  blockchain_sync_timestamp TIMESTAMP,
  verification_status VARCHAR(50) DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'verified', 'failed', 'tampered'))
);
```

---

## 🎓 Summary

**Before:**

```
Attendance → Hyperledger (complex) → Database
```

**After:**

```
Attendance → Database (primary) ✅
         ↓
         Solana Anchor (verification hash only)
```

✨ **Result:** Fast, scalable, and cryptographically verified attendance system!
