import { Router } from "express";

import { verifyTransactionOnSolana } from "../controllers/solanaController";

const BlockchainRoute = Router();

BlockchainRoute.post(
  "/verifyTransaction/:signature",
  verifyTransactionOnSolana,
);

export default BlockchainRoute;
