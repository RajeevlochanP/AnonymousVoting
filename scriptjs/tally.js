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

//parameters
let g = 0n, q = 0n, p = 0n, tally = 0n, base = 0n, T = 0n, N = 0n;

async function getParameters() {
    tally = await bulletin.accum();
    g = await bulletin.g();
    q = await bulletin.q();
    p = await bulletin.p();
    base = 16n;
    T = await bulletin.candidateCount();
    N = await bulletin.N();
    //   console.log(ttt);
}


function printPermutations(n, t) {
    function backtrack(pos, remaining, current) {
        if (pos === t - 1n) {
            // Last variable gets whatever is left
            current[pos] = remaining;
            if(computeM(current)){
                console.log(current.join(", "));
                return current;
            }
            console.log(current.join(", "));
            return null;
        }

        for (let i = 0n; i <= remaining; i++) {
            current[pos] = i;
            let res=backtrack(pos + 1n, remaining - i, current);
            if(res!==null){
                return res;
            }
        }
    }

    backtrack(0n, n, new Array(t).fill(0));
}

function genereratePermutations(n,t,array) {
    if (t==0n){
        if (computeM(array)){
            console.log(array);
            return array
        }
        return null
        
    }
    for(var i=0n; i<n; i++){
        let arr = [i, ...array ]
        const res = genereratePermutations(n,t-1n, arr)
        if (res){
            return res
        }
    }
}

function computeM(vector) {
    let pow = 1n;
    let m = 0n;
    for (let i of vector) {
        // console.log(typeof(vector[i]));
        m += i * pow;
        pow = pow * base;
    }

    return ((g ** m % p) === tally);
}

async function main() {
    await getParameters();
    genereratePermutations(N, T+1n, []);
}

main();