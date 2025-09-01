import crypto from "crypto";
import { ethers, keccak256 } from "ethers";
import * as dotenv from "dotenv";
import fs from "fs";

dotenv.config();
dotenv.config({ path: ".env.voters" });

const N = 5;    // No of Voters
const T = 3;    // No of Candidates



// Load env
const RPC_URL = process.env.RPC_URL;
const BULLETIN_ADDR = process.env.BULLETIN_ADDR;
const TEST_KEY = process.env.TEST_KEY;



const provider = new ethers.JsonRpcProvider(RPC_URL);
const test_wallet = new ethers.Wallet(TEST_KEY, provider);
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
      
    const bulletin = new ethers.Contract(BULLETIN_ADDR, artifact.abi, test_wallet);
    console.log("Using test address:", test_wallet.address);  

    g = BigInt(await bulletin.g()); 
    q = BigInt(await bulletin.q()); 
    p = BigInt(await bulletin.p()); 

    console.log(`Value of g = ${g}, q = ${q}, p = ${p}`);
        
    for (let i = 0; i < 5; i++) {
        await castVote(i+1)
        // await new Promise(resolve => setTimeout(resolve, 500));
    }
}


async function castVote(voterNo) {
    
    const VOTER_ADDR = process.env[`VOTER${voterNo}`]; 
    const VOTER_KEY = process.env[`VOTER_PRI${voterNo}`];
    const wallet = new ethers.Wallet(VOTER_KEY, provider);
    const bulletin = new ethers.Contract(BULLETIN_ADDR, artifact.abi, wallet);
    console.log("Using address:", wallet.address); 

    const x = BigInt(process.env[`VOTER${voterNo}_X`])
    const h = BigInt((await bulletin.voters(VOTER_ADDR))[3])
    const k = 2;
    const {hX, Y} = computeVote(h, x, k)
    const gX = modPow(g,x,p)

    var proof = new Array(10);

    // compute proof {r,d,a,b,w}
    for(var i=1; i<=T; i++){
        if(i == k){
            continue
        }
        const {r, d, a, b} = computeProof(hX, gX, h, Y, i);
        proof[i] = {r,d,a,b}
    }


    // compute {rk, dk}
    const hash_input = [
        gX.toString(16).padStart(64, "0"),
        Y.toString(16).padStart(64, "0"),
        ].join("");
    const c = BigInt(keccak256("0x" + hash_input)) % q;


    // submit proof



    // const tx = await bulletin.voterSignup(gX, gV, phi, n);
    // await tx.wait();
    // console.log(`Voter Signed up`);
    // await new Promise(resolve => setTimeout(resolve, 500));
}


function computeVote(h,x,k){
    const hX = modPow(h,x,p);
    const mk = BigInt(2**(4*k));
    const gM = modPow(g,mk, p);
    
    const Y = (hX*gM) % p
    return {hX, Y};
}

function computeProof(g, gX, h ,Y, k){
    const r = randomScalar(q)
    const d = randomScalar(q)

    const a = (modPow(g,r,p) * modPow(gX,d,p)) % p

    const m = BigInt(2**(4*k))
    const Gm = modInv(modPow(g,m,p),p); 
    const b = (modPow(h,r,p) * modPow(Y*Gm, d,p)) % p

    return {r,d,a,b};
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});




