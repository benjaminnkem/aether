// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { MockOracle } from "../src/MockOracle.sol";
import { ScriptBase } from "./ScriptBase.sol";

contract SeedFreshness is ScriptBase {
    function run() external {
        _requireSupportedChain();
        Deployment memory deployment = _readDeployment();
        vm.startBroadcast();
        MockOracle(deployment.approvedOracle).touch();
        MockOracle(deployment.unauthorizedOracle).touch();
        vm.stopBroadcast();
    }
}
