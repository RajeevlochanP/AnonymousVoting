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
    console.log("Using test address:", admin_wallet.address);

    g = BigInt(await bulletin.g());
    q = BigInt(await bulletin.q());
    p = BigInt(await bulletin.p());

    console.log(`Value of g = ${g}, q = ${q}, p = ${p}`);

    for (let i = 0; i < 5; i++) {
        await castVote(i + 1)
        // await new Promise(resolve => setTimeout(resolve, 500));
    }
    const tx = await bulletin.nextState();
    await tx.wait();
    console.log("Changed State");
}


async function castVote(voterNo) {

    const VOTER_ADDR = process.env[`VOTER${voterNo}`];
    const VOTER_KEY = process.env[`VOTER_PRI${voterNo}`];
    const wallet = new ethers.Wallet(VOTER_KEY, provider);
    const bulletin = new ethers.Contract(BULLETIN_ADDR, artifact.abi, wallet);
    console.log("Using address:", wallet.address);

    const x = BigInt(process.env[`VOTER${voterNo}_X`])
    const h = BigInt((await bulletin.voters(VOTER_ADDR))[3])
    const k = Number(randomScalar(BigInt(T+1)));
    const { hX, Y } = computeVote(h, x, k)
    const gX = modPow(g, x, p)
    const w = randomScalar(q);

    var proof = new Array(T + 1);

    console.log("voting candidate : "+k);
    
    // compute proof {r,d,a,b,w}
    for (var i = 0; i <= T; i++) {
        if (i == k) {
            proof[i] = { r: 0n, d: 0n, a: modPow(g, w, p), b: modPow(h, w, p) };
            continue;
        }
        const { r, d, a, b } = computeProof(g, gX, h, Y, i);
        proof[i] = { r, d, a, b }
    }

    // compute {rk, dk}
    let sumD = 0n;
    let hash = [
        gX.toString(16).padStart(64, "0"),
        Y.toString(16).padStart(64, "0"),
    ]
    for (let i = 0; i < T + 1; i++) {
        hash.push(proof[i].a.toString(16).padStart(64, "0"));
        hash.push(proof[i].b.toString(16).padStart(64, "0"));
        sumD += proof[i].d;
    }
    const hash_input = hash.join("");
    // console.log(hash_input);
    const c = BigInt(keccak256("0x" + hash_input)) % q;
    proof[k].d = (c + q - (sumD % q)) % q;
    proof[k].r = (w + q - ((x * proof[k].d) % q)) % q;
    console.log((proof[k].r + x * proof[k].d) % q == w % q);


    // console.log(proof);

    // submit proof
    const tx = await bulletin.vote(gX, Y, c, proof);
    await tx.wait();
    console.log(" Vote casted " + voterNo);
    await new Promise(resolve => setTimeout(resolve, 500));
}


function computeVote(h, x, k) {
    const hX = modPow(h, x, p);
    const mk = BigInt(2 ** (4 * k));
    const gM = modPow(g, mk, p);

    const Y = (hX * gM) % p
    return { hX, Y };
}

function computeProof(g, gX, h, Y, k) {
    const r = randomScalar(q)
    const d = randomScalar(q)

    const a = (modPow(g, r, p) * modPow(gX, d, p)) % p

    // console.log("a : " + a);

    const m = BigInt(2 ** (4 * k))
    const Gm = modInv(modPow(g, m, p), p);
    const b = (modPow(h, r, p) * modPow(Y * Gm, d, p)) % p

    return { r, d, a, b };
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});




