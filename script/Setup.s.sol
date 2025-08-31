// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.30;

import "forge-std/Script.sol";
import "../src/bulletin.sol";
import "forge-std/console.sol";

contract Setup is Script {
    function run() public {
        uint256 privateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address sender = vm.addr(privateKey);
        console.log("Using address:", sender);

        // bulletin contract address
        address bulletinAddr = 0x5FbDB2315678afecb367f032d93F642f64180aa3;
        Bulletin bulletin = Bulletin(bulletinAddr);
        // ===== CANDIDATES =====
        address[3] memory candidates = [
            vm.envAddress("CAND1"),
            vm.envAddress("CAND2"),
            vm.envAddress("CAND3")
        ];

        // ===== VOTERS =====
        address[5] memory voters = [
            vm.envAddress("VOTER1"),
            vm.envAddress("VOTER2"),
            vm.envAddress("VOTER3"),
            vm.envAddress("VOTER4"),
            vm.envAddress("VOTER5")
        ];

        // build memory array for registerVoters
        address[] memory votersList = new address[](voters.length);
        for (uint256 i = 0; i < voters.length; i++) {
            votersList[i] = voters[i];
        }

        vm.startBroadcast(privateKey);

        // register candidates
        for (uint256 i = 0; i < candidates.length; i++) {
            bulletin.registerCandidate(i + 1, candidates[i]);
        }

        bulletin.registerVoters(votersList);

        //retieve and check
        for (uint256 i = 0; i < candidates.length; i++) {
            console.log("Candidate address: ", bulletin.candidates(i + 1));
        }

        uint256 len = 5;
        for (uint256 i = 0; i < len; i++) {
            console.log("Voter address: ", bulletin.voterList(i));
        }

        vm.stopBroadcast();
    }
}
