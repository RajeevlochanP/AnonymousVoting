import { ethers } from "ethers";
import * as dotenv from "dotenv";
import fs from "fs";

dotenv.config();

// Load env
const RPC_URL = process.env.RPC_URL;
const TEST_KEY = process.env.TEST_KEY;
const BULLETIN_ADDR = process.env.BULLETIN_ADDR;

// Provider + Wallet
const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(TEST_KEY, provider);

// Load contract ABI + bytecode (from Foundry build artifacts)
const artifact = JSON.parse(fs.readFileSync("../out/bulletin.sol/Bulletin.json", "utf-8"));

const bulletin = new ethers.Contract(BULLETIN_ADDR, artifact.abi, wallet);
console.log("Using address:", wallet.address);


async function setupTest() {

    // === Read back ===
      for (let i = 0; i < 3; i++) {
        const cand = await bulletin.candidates(i + 1);
        console.log(`Candidate ${i + 1} addr: ${cand}`);
      }
    
      for (let i = 0; i < 5; i++) {
        const voter = await bulletin.voterList(i);
        console.log(`Voter ${i} addr: ${voter}`);
      }
}

async function signupTest() {
 
    for (let i = 0; i < 5; i++) {
      const voter = await bulletin.voterList(i);
      const voterDetails = await bulletin.voters(voter)
      console.log(`Voter ${i} details: ${voterDetails}`);

//       console.log(`
// x${i+1} = ${voterDetails[2]}
// h${i+1} = ${voterDetails[3]} 
//        `)
    }
}


async function main() {
  // await setupTest();
  // await runTransaction();
  await signupTest();
  return 0;
}

async function runTransaction() {
    const tx = await bulletin.nextState();
    await tx.wait();
    console.log("Computed H");
    
}




main().catch((err) => {
  console.error(err);
  process.exit(1);
});
