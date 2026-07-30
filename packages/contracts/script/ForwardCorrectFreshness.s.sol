// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { MockOracle } from "../src/MockOracle.sol";
import { ScriptBase } from "./ScriptBase.sol";

/// @notice Explicit forward correction for the fixture freshness failure.
contract ForwardCorrectFreshness is ScriptBase {
    function run() external {
        _requireSupportedChain();
        Deployment memory deployment = _readDeployment();
        vm.startBroadcast();
        MockOracle(deployment.approvedOracle).touch();
        vm.stopBroadcast();
    }
}
