// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

interface IERC20SavingsAsset {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}

/// @notice A Sepolia savings vault for deposits submitted by one configured KeeperHub executor.
/// @dev Deposits are bound to unique operation keys. Beneficiaries retain direct withdrawal
/// authority.
contract AetherSavingsVault {
    error ExecutorOnly();
    error InvalidAddress();
    error InvalidAmount();
    error OperationAlreadyUsed(bytes32 operationKey);
    error UnsupportedTokenBehavior();
    error InsufficientSavings();
    error TransferFailed();

    address public immutable keeperHubExecutor;

    mapping(bytes32 operationKey => uint256 amount) public depositAmount;
    mapping(bytes32 operationKey => address beneficiary) public depositBeneficiary;
    mapping(bytes32 operationKey => address token) public depositToken;
    mapping(address beneficiary => mapping(address token => uint256 amount)) public savingsBalance;

    event SavingsDeposited(
        bytes32 indexed operationKey,
        address indexed beneficiary,
        address indexed token,
        uint256 amount
    );
    event SavingsWithdrawn(
        address indexed beneficiary,
        address indexed token,
        address indexed recipient,
        uint256 amount
    );

    constructor(address executor) {
        if (executor == address(0)) revert InvalidAddress();
        keeperHubExecutor = executor;
    }

    modifier onlyExecutor() {
        if (msg.sender != keeperHubExecutor) revert ExecutorOnly();
        _;
    }

    function deposit(bytes32 operationKey, address token, address beneficiary, uint256 amount)
        external
        onlyExecutor
    {
        if (operationKey == bytes32(0) || token == address(0) || beneficiary == address(0)) {
            revert InvalidAddress();
        }
        if (amount == 0) revert InvalidAmount();
        if (depositBeneficiary[operationKey] != address(0)) {
            revert OperationAlreadyUsed(operationKey);
        }

        uint256 balanceBefore = IERC20SavingsAsset(token).balanceOf(address(this));
        if (!IERC20SavingsAsset(token).transferFrom(msg.sender, address(this), amount)) {
            revert TransferFailed();
        }
        uint256 balanceAfter = IERC20SavingsAsset(token).balanceOf(address(this));
        if (balanceAfter - balanceBefore != amount) revert UnsupportedTokenBehavior();

        depositAmount[operationKey] = amount;
        depositBeneficiary[operationKey] = beneficiary;
        depositToken[operationKey] = token;
        savingsBalance[beneficiary][token] += amount;
        emit SavingsDeposited(operationKey, beneficiary, token, amount);
    }

    /// @notice Beneficiaries can always return their savings to an address they control.
    function withdraw(address token, uint256 amount, address recipient) external {
        if (token == address(0) || recipient == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();
        uint256 available = savingsBalance[msg.sender][token];
        if (available < amount) revert InsufficientSavings();

        savingsBalance[msg.sender][token] = available - amount;
        if (!IERC20SavingsAsset(token).transfer(recipient, amount)) revert TransferFailed();
        emit SavingsWithdrawn(msg.sender, token, recipient, amount);
    }
}
