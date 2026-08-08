// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Script } from "forge-std/Script.sol";
import { AetherDemoVault } from "../src/demo/AetherDemoVault.sol";

contract DeployAetherDemo is Script {
    function run() external returns (AetherDemoVault vault) {
        address executor = vm.envAddress("KEEPERHUB_EXECUTOR_ADDRESS");
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);
        vault = new AetherDemoVault(executor);
        vm.stopBroadcast();
    }
}
