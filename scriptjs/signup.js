import crypto from "crypto";
import { ethers, keccak256 } from "ethers";
import * as dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

// Load env
const RPC_URL = process.env.RPC_URL;
const BULLETIN_ADDR = process.env.BULLETIN_ADDR;
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;


const provider = new ethers.JsonRpcProvider(RPC_URL);
const admin_wallet = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider);
const artifact = JSON.parse(fs.readFileSync("../out/bulletin.sol/Bulletin.json", "utf-8"));

var g = 1n;
var q = 1n;
var p = 1n;
    

const modPow = (base, exp, m = q) => {
    let res = 1n, b = (base % m), e = exp;
    while (e > 0n) {
    if (e & 1n) res = (res * b) % m;
    b = (b * b) % m;
    e >>= 1n;
    }
    return res;
};
const modInv = (a, m) => modPow(a, m - 2n, m);
// random scalar < r
const randomScalar = (r) => {
    let bytes = BigInt("0x" + crypto.randomBytes(32).toString("hex"));
    return bytes % r;
};


async function main() {
      
    const bulletin = new ethers.Contract(BULLETIN_ADDR, artifact.abi, admin_wallet);
    console.log("Using admin address:", admin_wallet.address);  

    g = BigInt(await bulletin.g()); 
    q = BigInt(await bulletin.q()); 
    p = BigInt(await bulletin.p()); 

    console.log(`Value of g = ${g}, q = ${q}, p = ${p}`);
        
    for (let i = 0; i < 5; i++) {
        await voterSignup(i+1)
    }
    const tx = await bulletin.nextState();
    await tx.wait();
    console.log("Changed State");
}


async function voterSignup(voterNo) {
    const VOTER_KEY = process.env[`VOTER_PRI${voterNo}`];
    const wallet = new ethers.Wallet(VOTER_KEY, provider);
    const bulletin = new ethers.Contract(BULLETIN_ADDR, artifact.abi, wallet);
    console.log("Using address:", wallet.address);  

    
    const v = randomScalar(q);
    const x = randomScalar(q);

    const gV = modPow(g,v,p);
    const gX = modPow(g,x,p);
    const hash_input = [
        g.toString(16).padStart(64, "0"),
        gX.toString(16).padStart(64, "0"),
        gV.toString(16).padStart(64, "0"),
      ].join("");
    const n = BigInt(keccak256("0x" + hash_input)) % q;

    const xn = (x*n) % q;
    const phi = (v - xn + q) % q;

    const gP = modPow(g,phi,p);
    const xN = modPow(gX,n,p);
    const lhs = (gP * xN) % p


    console.log(`
        v = ${v}, gV = ${gV}
        x = ${x}, gX = ${gX}
        phi = ${phi}, n = ${n}
        gP = ${gP}, xN = ${xN}
        lhs = ${lhs}
        `);

    const tx = await bulletin.voterSignup(gX, gV, phi, n);
    await tx.wait();
    console.log(`Voter Signed up`);
    saveEnvVar(`VOTER${voterNo}_X`, x, '.env.voters')
    await new Promise(resolve => setTimeout(resolve, 500));
    
}



function saveEnvVar(key, value, file = ".env") {
  const envPath = path.resolve(process.cwd(), file);
  let envContent = "";

  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, "utf8");

    // If key already exists, replace it
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      envContent += `\n${key}=${value}`;
    }
  } else {
    envContent = `${key}=${value}`;
  }

  fs.writeFileSync(envPath, envContent);
  console.log(`Updated ${file}: ${key}=${value}`);
}





main().catch((err) => {
  console.error(err);
  process.exit(1);
});




