// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "openzeppelin-contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { ArcadiaMarket } from "../src/ArcadiaMarket.sol";
import { MockOracle } from "../src/MockOracle.sol";

abstract contract ArcadiaTestBase is Test {
    address internal admin = makeAddr("admin");
    address internal executor = makeAddr("executor");
    address internal driftActor = makeAddr("driftActor");
    address internal outsider = makeAddr("outsider");

    ArcadiaMarket internal implementation;
    ArcadiaMarket internal market;
    MockOracle internal approvedOracle;
    MockOracle internal unauthorizedOracle;

    uint256 internal constant MAX_ORACLE_AGE = 1 hours;

    function setUp() public virtual {
        vm.warp(1_800_000_000);
        approvedOracle = new MockOracle(admin, block.timestamp);
        unauthorizedOracle = new MockOracle(admin, block.timestamp);
        implementation = new ArcadiaMarket();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(implementation),
            abi.encodeCall(
                ArcadiaMarket.initialize,
                (admin, executor, driftActor, address(approvedOracle), MAX_ORACLE_AGE)
            )
        );
        market = ArcadiaMarket(address(proxy));
    }
}
