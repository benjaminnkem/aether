// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { IAccessControl } from "openzeppelin-contracts/access/IAccessControl.sol";

import { ArcadiaTestBase } from "./ArcadiaTestBase.sol";
import { ArcadiaMarket } from "../src/ArcadiaMarket.sol";

contract ArcadiaMarketUnitTest is ArcadiaTestBase {
    function test_InitializesProxyAndFreshApprovedOracle() public view {
        assertEq(market.oracle(), address(approvedOracle));
        assertEq(market.maxOracleAge(), MAX_ORACLE_AGE);
        assertTrue(market.hasRole(market.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(market.hasRole(market.ORACLE_ADMIN_ROLE(), executor));

        (address configured, uint256 updatedAt, bool fresh) = market.oracleStatus();
        assertEq(configured, address(approvedOracle));
        assertEq(updatedAt, block.timestamp);
        assertTrue(fresh);
    }

    function test_SetOracleRequiresExplicitRole() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                outsider,
                market.ORACLE_ADMIN_ROLE()
            )
        );
        vm.prank(outsider);
        market.setOracle(address(unauthorizedOracle));
    }

    function test_SetOracleRejectsEOA() public {
        vm.expectRevert(abi.encodeWithSelector(ArcadiaMarket.OracleHasNoCode.selector, outsider));
        vm.prank(executor);
        market.setOracle(outsider);
    }

    function test_SetOracleEmitsEvidenceAndUpdatesPointer() public {
        vm.expectEmit(true, true, true, true);
        emit ArcadiaMarket.OracleConfigured(
            address(approvedOracle), address(unauthorizedOracle), executor
        );
        vm.prank(executor);
        market.setOracle(address(unauthorizedOracle));
        assertEq(market.oracle(), address(unauthorizedOracle));
    }

    function test_StaleOracleFailsIndependentInvariant() public {
        vm.warp(block.timestamp + MAX_ORACLE_AGE + 1);
        assertFalse(market.isOracleFresh());
    }

    function test_ImplementationCannotBeInitialized() public {
        vm.expectRevert();
        implementation.initialize(
            admin, executor, driftActor, address(approvedOracle), MAX_ORACLE_AGE
        );
    }
}
