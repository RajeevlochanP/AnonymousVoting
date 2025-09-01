// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.30;

import {Script} from "forge-std/Script.sol";
import {Bulletin} from "../src/bulletin.sol";
import "forge-std/console.sol";

contract BulletinScript is Script {
    Bulletin public bulletin;

    function setUp() public {}

    function run() public {
        uint256 privateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address sender = vm.addr(privateKey);

        console.log("using address:", sender);

        vm.startBroadcast();

        bulletin = new Bulletin(3, 97, 96);
        console.log("Bulletin deployed at:", address(bulletin));


        vm.stopBroadcast();
    }
}
