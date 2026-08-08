// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test } from "forge-std/Test.sol";
import { AetherDemoVault } from "../src/demo/AetherDemoVault.sol";

contract AetherDemoVaultTest is Test {
    address private executor = makeAddr("keeperHubExecutor");
    AetherDemoVault private vault;

    function setUp() public {
        vault = new AetherDemoVault(executor);
    }

    function testHappyPath() public {
        bytes32 runKey = keccak256("happy");
        vm.startPrank(executor);
        vault.withdrawSource(runKey, 100);
        vault.authorizeDestination(runKey);
        vault.depositDestination(runKey, 100);
        vm.stopPrank();
        assertEq(vault.sourceBalance(runKey), 999_900);
        assertEq(vault.inTransitBalance(runKey), 0);
        assertEq(vault.destinationBalance(runKey), 100);
    }

    function testPartialFailureCanRestoreSafeState() public {
        bytes32 runKey = keccak256("partial");
        vm.startPrank(executor);
        vault.withdrawSource(runKey, 100);
        vault.authorizeDestination(runKey);
        vm.expectRevert(AetherDemoVault.DemoFailure.selector);
        vault.blockedDestinationDeposit(runKey);
        vault.revokeAuthorization(runKey);
        vault.restoreSource(runKey, 100);
        vm.stopPrank();
        assertEq(vault.sourceBalance(runKey), 1_000_000);
        assertEq(vault.inTransitBalance(runKey), 0);
        assertFalse(vault.destinationAuthorized(runKey));
    }

    function testOnlyExecutorMayWrite() public {
        vm.expectRevert(AetherDemoVault.ExecutorOnly.selector);
        vault.authorizeDestination(keccak256("unauthorized"));
    }

    function testDuplicateActionIsRejected() public {
        bytes32 runKey = keccak256("unknown-outcome");
        vm.startPrank(executor);
        vault.authorizeDestination(runKey);
        vm.expectPartialRevert(AetherDemoVault.AlreadyExecuted.selector);
        vault.authorizeDestination(runKey);
        vm.stopPrank();
    }

    function testFuzzCapitalIsConserved(uint256 amount) public {
        amount = bound(amount, 1, 1_000_000);
        bytes32 runKey = keccak256(abi.encode(amount));
        vm.startPrank(executor);
        vault.withdrawSource(runKey, amount);
        vault.restoreSource(runKey, amount);
        vm.stopPrank();
        assertEq(
            vault.sourceBalance(runKey) + vault.inTransitBalance(runKey)
                + vault.destinationBalance(runKey),
            1_000_000
        );
    }
}
