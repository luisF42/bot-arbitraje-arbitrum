// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Ejecuta las DOS operaciones del arbitraje en una sola transacción.
// Si al final no hay ganancia, TODO se revierte: solo se pierde el gas, nunca el capital.

interface IERC20 {
    function balanceOf(address) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

interface ISwapRouter02 {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

interface IUniswapV2Router {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

contract ArbExecutor {
    address public immutable owner;

    // kind: 0 = Uniswap V3 (SwapRouter02), 1 = router tipo Uniswap V2 (Sushi, etc.)
    struct Leg {
        uint8 kind;
        address router;
        uint24 fee;
    }

    event Arbitraje(uint256 amountIn, uint256 profit);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "no autorizado");
        _;
    }

    function executeArb(
        address tokenA,
        address tokenB,
        uint256 amountIn,
        Leg calldata leg1,
        Leg calldata leg2,
        uint256 minProfit,
        uint256 deadline
    ) external onlyOwner returns (uint256 profit) {
        require(block.timestamp <= deadline, "expirado");
        uint256 antes = IERC20(tokenA).balanceOf(address(this));
        require(antes >= amountIn, "saldo insuficiente");

        uint256 recibidoB = _swap(leg1, tokenA, tokenB, amountIn);
        _swap(leg2, tokenB, tokenA, recibidoB);

        uint256 despues = IERC20(tokenA).balanceOf(address(this));
        require(despues >= antes + minProfit, "sin ganancia");
        profit = despues - antes;
        emit Arbitraje(amountIn, profit);
    }

    function _swap(Leg calldata leg, address tokenIn, address tokenOut, uint256 amount)
        internal
        returns (uint256 out)
    {
        require(IERC20(tokenIn).approve(leg.router, amount), "approve fallo");
        if (leg.kind == 0) {
            out = ISwapRouter02(leg.router).exactInputSingle(
                ISwapRouter02.ExactInputSingleParams({
                    tokenIn: tokenIn,
                    tokenOut: tokenOut,
                    fee: leg.fee,
                    recipient: address(this),
                    amountIn: amount,
                    amountOutMinimum: 0,
                    sqrtPriceLimitX96: 0
                })
            );
        } else {
            address[] memory path = new address[](2);
            path[0] = tokenIn;
            path[1] = tokenOut;
            uint256[] memory amounts = IUniswapV2Router(leg.router).swapExactTokensForTokens(
                amount, 0, path, address(this), block.timestamp
            );
            out = amounts[amounts.length - 1];
        }
    }

    // Retirar tokens (por ejemplo, tus USDC) de vuelta a tu wallet
    function withdraw(address token, uint256 amount) external onlyOwner {
        require(IERC20(token).transfer(owner, amount), "transfer fallo");
    }

    function withdrawETH() external onlyOwner {
        (bool ok, ) = owner.call{value: address(this).balance}("");
        require(ok, "envio fallo");
    }

    receive() external payable {}
}
