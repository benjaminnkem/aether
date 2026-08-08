// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test } from "forge-std/Test.sol";
import { AetherSavingsVault } from "../src/AetherSavingsVault.sol";

contract SavingsToken {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address account, uint256 amount) external {
        balanceOf[account] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address recipient, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[recipient] += amount;
        return true;
    }

    function transferFrom(address sender, address recipient, uint256 amount)
        external
        returns (bool)
    {
        allowance[sender][msg.sender] -= amount;
        balanceOf[sender] -= amount;
        balanceOf[recipient] += amount;
        return true;
    }
}

contract AetherSavingsVaultTest is Test {
    address private executor = makeAddr("keeperHubExecutor");
    address private beneficiary = makeAddr("beneficiary");
    AetherSavingsVault private vault;
    SavingsToken private token;

    function setUp() public {
        vault = new AetherSavingsVault(executor);
        token = new SavingsToken();
        token.mint(executor, 1_000_000);
        vm.prank(executor);
        token.approve(address(vault), type(uint256).max);
    }

    function testExecutorDepositsAndBeneficiaryWithdraws() public {
        bytes32 operationKey = keccak256("savings-run");
        vm.prank(executor);
        vault.deposit(operationKey, address(token), beneficiary, 250_000);

        assertEq(vault.depositAmount(operationKey), 250_000);
        assertEq(vault.depositBeneficiary(operationKey), beneficiary);
        assertEq(vault.savingsBalance(beneficiary, address(token)), 250_000);

        vm.prank(beneficiary);
        vault.withdraw(address(token), 100_000, beneficiary);
        assertEq(vault.savingsBalance(beneficiary, address(token)), 150_000);
        assertEq(token.balanceOf(beneficiary), 100_000);
    }

    function testOnlyExecutorMayDeposit() public {
        vm.expectRevert(AetherSavingsVault.ExecutorOnly.selector);
        vault.deposit(keccak256("unauthorized"), address(token), beneficiary, 1);
    }

    function testOperationKeyCannotBeReused() public {
        bytes32 operationKey = keccak256("one-economic-effect");
        vm.startPrank(executor);
        vault.deposit(operationKey, address(token), beneficiary, 1);
        vm.expectPartialRevert(AetherSavingsVault.OperationAlreadyUsed.selector);
        vault.deposit(operationKey, address(token), beneficiary, 1);
        vm.stopPrank();
    }

    function testFuzzAccounting(uint128 first, uint128 second) public {
        first = uint128(bound(first, 1, 500_000));
        second = uint128(bound(second, 1, 500_000));
        vm.startPrank(executor);
        vault.deposit(keccak256("first"), address(token), beneficiary, first);
        vault.deposit(keccak256("second"), address(token), beneficiary, second);
        vm.stopPrank();
        assertEq(vault.savingsBalance(beneficiary, address(token)), uint256(first) + second);
        assertEq(token.balanceOf(address(vault)), uint256(first) + second);
    }
}
