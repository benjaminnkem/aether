// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { ArcadiaMarket } from "../src/ArcadiaMarket.sol";
import { ScriptBase } from "./ScriptBase.sol";

contract CreateUnauthorizedOracleDrift is ScriptBase {
    function run() external {
        _requireSupportedChain();
        Deployment memory deployment = _readDeployment();
        vm.startBroadcast();
        ArcadiaMarket(deployment.marketProxy).setOracle(deployment.unauthorizedOracle);
        vm.stopBroadcast();
    }
}
