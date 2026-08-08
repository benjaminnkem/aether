// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @notice Fixed-purpose Sepolia fixture for Aether's three public demo scenarios.
/// It accepts no arbitrary recipients or calls. Only the configured KeeperHub executor may write.
contract AetherDemoVault {
    error ExecutorOnly();
    error AlreadyExecuted(bytes32 actionKey);
    error AmountOutOfRange();
    error InsufficientSource();
    error InsufficientTransit();
    error AuthorizationRequired();
    error DemoFailure();

    uint256 public constant MAX_ACTION_AMOUNT = 1_000_000;
    uint256 public constant INITIAL_SOURCE_BALANCE = 1_000_000;
    address public immutable keeperHubExecutor;

    struct RunState {
        uint256 source;
        uint256 inTransit;
        uint256 destination;
        bool authorized;
        bool initialized;
    }
    mapping(bytes32 => RunState) private runs;
    mapping(bytes32 => uint256) public actionCount;

    event DemoAction(bytes32 indexed runKey, bytes4 indexed action, uint256 amount, uint256 count);

    constructor(address executor) {
        if (executor == address(0)) revert AmountOutOfRange();
        keeperHubExecutor = executor;
    }

    modifier onlyExecutor() {
        if (msg.sender != keeperHubExecutor) revert ExecutorOnly();
        _;
    }

    function withdrawSource(bytes32 runKey, uint256 amount) external onlyExecutor {
        _once(runKey, this.withdrawSource.selector, amount);
        RunState storage state = _state(runKey);
        if (amount == 0 || amount > MAX_ACTION_AMOUNT) revert AmountOutOfRange();
        if (state.source < amount) revert InsufficientSource();
        state.source -= amount;
        state.inTransit += amount;
    }

    function authorizeDestination(bytes32 runKey) external onlyExecutor {
        _once(runKey, this.authorizeDestination.selector, 0);
        _state(runKey).authorized = true;
    }

    function depositDestination(bytes32 runKey, uint256 amount) external onlyExecutor {
        _once(runKey, this.depositDestination.selector, amount);
        RunState storage state = _state(runKey);
        if (!state.authorized) revert AuthorizationRequired();
        if (amount == 0 || amount > state.inTransit) revert InsufficientTransit();
        state.inTransit -= amount;
        state.destination += amount;
    }

    function blockedDestinationDeposit(bytes32) external pure {
        revert DemoFailure();
    }

    function revokeAuthorization(bytes32 runKey) external onlyExecutor {
        _once(runKey, this.revokeAuthorization.selector, 0);
        _state(runKey).authorized = false;
    }

    function restoreSource(bytes32 runKey, uint256 amount) external onlyExecutor {
        _once(runKey, this.restoreSource.selector, amount);
        RunState storage state = _state(runKey);
        if (amount == 0 || amount > state.inTransit) revert InsufficientTransit();
        state.inTransit -= amount;
        state.source += amount;
    }

    function sourceBalance(bytes32 runKey) external view returns (uint256) {
        RunState storage state = runs[runKey];
        return state.initialized ? state.source : INITIAL_SOURCE_BALANCE;
    }

    function inTransitBalance(bytes32 runKey) external view returns (uint256) {
        return runs[runKey].inTransit;
    }

    function destinationBalance(bytes32 runKey) external view returns (uint256) {
        return runs[runKey].destination;
    }

    function destinationAuthorized(bytes32 runKey) external view returns (bool) {
        return runs[runKey].authorized;
    }

    function _once(bytes32 runKey, bytes4 action, uint256 amount) private {
        bytes32 actionKey = keccak256(abi.encode(runKey, action));
        if (actionCount[actionKey] != 0) revert AlreadyExecuted(actionKey);
        actionCount[actionKey] = 1;
        emit DemoAction(runKey, action, amount, 1);
    }

    function _state(bytes32 runKey) private returns (RunState storage state) {
        state = runs[runKey];
        if (!state.initialized) {
            state.source = INITIAL_SOURCE_BALANCE;
            state.initialized = true;
        }
    }
}
