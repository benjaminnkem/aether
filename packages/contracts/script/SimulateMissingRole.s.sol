// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { IAccessControl } from "openzeppelin-contracts/access/IAccessControl.sol";

import { ArcadiaMarket } from "../src/ArcadiaMarket.sol";
import { ScriptBase } from "./ScriptBase.sol";

contract SimulateMissingRole is ScriptBase {
    error SimulationUnexpectedlySucceeded();
    error UnexpectedRevert(bytes revertData);

    function run() external returns (bytes memory revertData) {
        _requireSupportedChain();
        Deployment memory deployment = _readDeployment();
        address unprivileged = vm.envOr(
            "AETHER_UNPRIVILEGED_ADDRESS", address(0xA11cE00000000000000000000000000000000005)
        );

        vm.prank(unprivileged);
        (bool success, bytes memory result) = deployment.marketProxy
            .call(abi.encodeCall(ArcadiaMarket.setOracle, (deployment.approvedOracle)));
        if (success) revert SimulationUnexpectedlySucceeded();
        if (result.length < 4) revert UnexpectedRevert(result);
        // Safe after the length check; only the custom-error selector is inspected.
        // forge-lint: disable-next-line(unsafe-typecast)
        if (bytes4(result) != IAccessControl.AccessControlUnauthorizedAccount.selector) {
            revert UnexpectedRevert(result);
        }
        return result;
    }
}
