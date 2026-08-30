import { Router } from "express";

import {
  verifyTransactionOnSolana,
  testAttendanceBlockchain,
} from "../controllers/solanaController";

const BlockchainRoute = Router();

// Verify an existing Solana transaction
BlockchainRoute.get("/verifyTransaction/:signature", verifyTransactionOnSolana);

// TEMPORARY: Direct blockchain integration test
BlockchainRoute.post("/test-attendance", testAttendanceBlockchain);

export default BlockchainRoute;

/*
import { Router } from "express";

import { verifyTransactionOnSolana } from "../controllers/solanaController";

const BlockchainRoute = Router();

BlockchainRoute.post(
  "/verifyTransaction/:signature",
  verifyTransactionOnSolana,
);

export default BlockchainRoute;
*/
