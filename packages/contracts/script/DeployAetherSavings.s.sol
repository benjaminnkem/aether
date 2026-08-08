// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Script } from "forge-std/Script.sol";
import { AetherSavingsVault } from "../src/AetherSavingsVault.sol";

contract DeployAetherSavings is Script {
    function run() external returns (AetherSavingsVault vault) {
        address executor = vm.envAddress("SAVINGS_KEEPERHUB_EXECUTOR_ADDRESS");
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);
        vault = new AetherSavingsVault(executor);
        vm.stopBroadcast();
    }
}
