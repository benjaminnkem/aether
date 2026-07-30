// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { MockOracle } from "../src/MockOracle.sol";
import { ScriptBase } from "./ScriptBase.sol";

/// @notice Run after RestoreApprovedOracle to make the selected source stale.
contract CreatePostWriteVerificationFailure is ScriptBase {
    function run() external {
        _requireSupportedChain();
        Deployment memory deployment = _readDeployment();
        // Script intentionally derives a stale fixture timestamp from the current block.
        // forge-lint: disable-next-line(block-timestamp)
        uint256 staleAt = block.timestamp > deployment.maxOracleAge
            ? block.timestamp - deployment.maxOracleAge - 1
            : 0;
        vm.startBroadcast();
        MockOracle(deployment.approvedOracle).setUpdatedAt(staleAt);
        vm.stopBroadcast();
    }
}
