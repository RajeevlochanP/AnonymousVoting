import { ethers, NonceManager } from "ethers";
import * as dotenv from "dotenv";
import fs from "fs";

dotenv.config();

// Load env
const RPC_URL = process.env.RPC_URL;
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
const CAND1 = process.env.CAND1;
const CAND2 = process.env.CAND2;
const CAND3 = process.env.CAND3;
const VOTERS = [
  process.env.VOTER1,
  process.env.VOTER2,
  process.env.VOTER3,
  process.env.VOTER4,
  process.env.VOTER5,
];
var BULLETIN_ADDR = 0;


const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider);
const artifact = JSON.parse(fs.readFileSync("../out/bulletin.sol/Bulletin.json", "utf-8"));

const p = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617"); // BN254 prime
const q = p - 1n // Group order
const g = 5n; // Generator


async function main() {

  const factory = new ethers.ContractFactory(
    artifact.abi,
    artifact.bytecode.object,
    wallet
  );

  console.log("Deploying Bulletin...");
  const bulletin = await factory.deploy(g, p, q);
  await bulletin.waitForDeployment();
  BULLETIN_ADDR = await bulletin.getAddress()
  await new Promise(resolve => setTimeout(resolve, 500));
  console.log("Bulletin deployed at:", BULLETIN_ADDR);

  // Admin Setup

  await setup(bulletin);
  console.log("Setup complete"); 
  const tx = await bulletin.nextState();
  await tx.wait();
  console.log("Changed State");
}


// === SETUP ===
async function setup(bulletin) {

  // === Register candidates ===
  const candidates = [CAND1, CAND2, CAND3];
  for (let i = 0; i < candidates.length; i++) {
    const tx = await bulletin.registerCandidate(i + 1, candidates[i]);
    await tx.wait();
    console.log(`Registered candidate ${i + 1}: ${candidates[i]}`);
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // === Register voters ===
  const txVoters = await bulletin.registerVoters(VOTERS);
  await txVoters.wait();
  console.log("Registered voters:", VOTERS);
  await new Promise(resolve => setTimeout(resolve, 500));
  


}



main().catch((err) => {
  console.error(err);
  process.exit(1);
});
