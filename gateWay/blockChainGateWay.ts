import * as grpc from "@grpc/grpc-js";
import {
  connect,
  Contract,
  Identity,
  Signer,
  signers,
} from "@hyperledger/fabric-gateway";
import * as crypto from "crypto";
import { promises as fs } from "fs";
import * as path from "path";

// Store the connection globally so we only open it ONCE and reuse it for all requests. This is critical for performance and resource management.
let gatewayConnection: any = null;
let blockchainContract: Contract | null = null;

const getBlockchainConnection = async () => {
  if (blockchainContract) return blockchainContract; // Return existing connection

  const cryptoPath = path.resolve(__dirname, "../config/blockchain");
  const tlsCertPath = path.join(cryptoPath, "tls-cert.pem"); // Adjusted to match the new file name given by job
  const certPath = path.join(cryptoPath, "user-cert.pem"); // Adjusted to match the new file name given by job
  const keyPath = path.join(cryptoPath, "private-key.pem"); // Adjusted to match the new file name given by job

  const tlsRootCert = await fs.readFile(tlsCertPath);
  const certificate = await fs.readFile(certPath, "utf8");
  const privateKeyBytes = await fs.readFile(keyPath);
  const privateKey = crypto.createPrivateKey(privateKeyBytes);

  const identity: Identity = {
    mspId: "Org1MSP",
    credentials: new Uint8Array(Buffer.from(certificate)),
  };
  const signer: Signer = signers.newPrivateKeySigner(privateKey);

  const client = new grpc.Client(
    process.env.HLF_PEER_ENDPOINT!,
    grpc.credentials.createSsl(tlsRootCert),
  );

  const gateway = connect({
    client,
    identity,
    signer,
    evaluateOptions: () => ({ deadline: Date.now() + 5000 }),
    submitOptions: () => ({ deadline: Date.now() + 5000 }),
  });

  const network = gateway.getNetwork(process.env.HLF_CHANNEL_NAME!);
  blockchainContract = network.getContract(process.env.HLF_CHAINCODE_NAME!);

  return blockchainContract;
};

export const BlockchainGateway = {
  recordAttendance: async (
    studentId: string,
    sessionId: string,
  ): Promise<string> => {
    const contract = await getBlockchainConnection(); // Reuse connection

    const commit = await contract.submitAsync("MarkPresent", {
      arguments: [studentId, sessionId],
    });

    return commit.getTransactionId();
  },
};
