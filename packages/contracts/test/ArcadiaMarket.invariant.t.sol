// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { ArcadiaTestBase } from "./ArcadiaTestBase.sol";
import { Test } from "forge-std/Test.sol";

import { ArcadiaMarket } from "../src/ArcadiaMarket.sol";
import { MockOracle } from "../src/MockOracle.sol";

contract OracleHandler is Test {
    ArcadiaMarket internal immutable market;
    MockOracle internal immutable approved;
    MockOracle internal immutable unauthorized;
    address internal immutable executor;
    address internal immutable outsider;

    constructor(
        ArcadiaMarket market_,
        MockOracle approved_,
        MockOracle unauthorized_,
        address executor_,
        address outsider_
    ) {
        market = market_;
        approved = approved_;
        unauthorized = unauthorized_;
        executor = executor_;
        outsider = outsider_;
    }

    function selectOracle(bool selectApproved) external {
        vm.prank(executor);
        market.setOracle(address(selectApproved ? approved : unauthorized));
    }

    function unauthorizedSelection(bool selectApproved) external {
        vm.prank(outsider);
        (bool success,) = address(market)
            .call(
                abi.encodeCall(
                    ArcadiaMarket.setOracle, (address(selectApproved ? approved : unauthorized))
                )
            );
        assertFalse(success);
    }
}

contract ArcadiaMarketInvariantTest is ArcadiaTestBase {
    OracleHandler internal handler;

    function setUp() public override {
        super.setUp();
        handler = new OracleHandler(market, approvedOracle, unauthorizedOracle, executor, outsider);
        targetContract(address(handler));
    }

    function invariant_OracleAlwaysHasCode() public view {
        assertNotEq(market.oracle(), address(0));
        assertGt(market.oracle().code.length, 0);
    }

    function invariant_OutsiderNeverGainsOracleRole() public view {
        assertFalse(market.hasRole(market.ORACLE_ADMIN_ROLE(), outsider));
    }
}
