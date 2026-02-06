// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { SD59x18 } from "@prb/math/SD59x18.sol";

library GaussianMath {
    SD59x18 internal constant SQRT_2PI = SD59x18.wrap(2_506628274631000502);
    SD59x18 internal constant SQRT_PI = SD59x18.wrap(1_772453850905516027);
    SD59x18 internal constant TWO = SD59x18.wrap(2e18);
    SD59x18 internal constant ONE = SD59x18.wrap(1e18);
    SD59x18 internal constant HALF = SD59x18.wrap(0.5e18);

    function pdf(SD59x18 x, SD59x18 mu, SD59x18 sigma) internal pure returns (SD59x18) {
        SD59x18 z = (x - mu).div(sigma);
        return (-(z.mul(z).mul(HALF))).exp().div(sigma.mul(SQRT_2PI));
    }

    function l2Norm(SD59x18 sigma) internal pure returns (SD59x18) {
        return ONE.div(TWO.mul(sigma).mul(SQRT_PI)).sqrt();
    }

    function scaledPdf(SD59x18 x, SD59x18 mu, SD59x18 sigma, SD59x18 k) internal pure returns (SD59x18) {
        return k.mul(pdf(x, mu, sigma)).div(l2Norm(sigma));
    }

    function peak(SD59x18 k, SD59x18 sigma) internal pure returns (SD59x18) {
        return k.mul(ONE.div(sigma.mul(SQRT_PI)).sqrt());
    }

    function minSigma(SD59x18 k, SD59x18 b) internal pure returns (SD59x18) {
        return k.mul(k).div(b.mul(b).mul(SQRT_PI));
    }
}
