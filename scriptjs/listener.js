import { ethers } from "ethers";

import * as dotenv from "dotenv";
import fs from "fs";

dotenv.config();

// Load env
const RPC_URL = process.env.RPC_URL;
const BULLETIN_ADDR = process.env.BULLETIN_ADDR;
const TEST_KEY = process.env.TEST_KEY;


const provider = new ethers.JsonRpcProvider(RPC_URL);
const test_wallet = new ethers.Wallet(TEST_KEY, provider);
const artifact = JSON.parse(fs.readFileSync("../out/bulletin.sol/Bulletin.json", "utf-8"));
const contract = new ethers.Contract(BULLETIN_ADDR, artifact.abi, test_wallet);

// Listener for "CandidateRegistered" event
contract.on("CandidateRegistered", (candidateId, candidateEOA) => {
    console.log(`Candidate Registered: ID = ${candidateId}, EOA = ${candidateEOA}`);
});

// Listener for "VoterRegistered" event
contract.on("VoterRegistered", (eoca) => {
    console.log(`Voter Registered: EOA = ${eoca}`);
});

// Listener for "Voted" event
contract.on("Voted", (eoaHash, candidateId, X) => {
    console.log(`Voted: EOA Hash = ${eoaHash}, Candidate ID = ${candidateId}, X = ${X}`);
});

// Listener for "OwnerChanged" event
contract.on("OwnerChanged", (oldOwner, newOwner) => {
    console.log(`Owner Changed: Old Owner = ${oldOwner}, New Owner = ${newOwner}`);
});

// Listener for "voterSignupEvent" event
contract.on("voterSignupEvent", (eoa, X) => {
    console.log(`Voter Signed Up: EOA = ${eoa}, X = ${X}`);
});

// Listener for "stateChange" event
contract.on("stateChange", (s) => {
    console.log(`State Changed: New State = ${s}`);
});

contract.on("Debug", (gV, lhs, rhs, phi, n) => {
    console.log("Debug values:", gV, lhs, rhs, phi, n);
});


console.log("Listening for events...");
