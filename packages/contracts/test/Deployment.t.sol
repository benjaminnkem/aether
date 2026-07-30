// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { ArcadiaTestBase } from "./ArcadiaTestBase.sol";
import { DeployArcadia } from "../script/DeployArcadia.s.sol";
import { ScriptBase } from "../script/ScriptBase.sol";

contract DeploymentTest is ArcadiaTestBase {
    bytes32 internal constant IMPLEMENTATION_SLOT =
        bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1);

    function test_ProxyImplementationAndRoleEvidence() public view {
        address observedImplementation =
            address(uint160(uint256(vm.load(address(market), IMPLEMENTATION_SLOT))));
        assertEq(observedImplementation, address(implementation));
        assertGt(observedImplementation.code.length, 0);
        assertTrue(market.hasRole(market.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(market.hasRole(market.ORACLE_ADMIN_ROLE(), executor));
    }

    function test_OnlySupportedDeploymentChains() public {
        DeployArcadia deploymentScript = new DeployArcadia();
        vm.chainId(1);
        vm.expectRevert(abi.encodeWithSelector(ScriptBase.UnsupportedChain.selector, 1));
        deploymentScript.run();
    }
}
