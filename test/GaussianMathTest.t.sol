// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import { SD59x18, sd } from "@prb/math/SD59x18.sol";
import { GaussianMath } from "../src/GaussianMath.sol";

contract GaussianMathTest is Test {
    SD59x18 internal constant SQRT_2PI = SD59x18.wrap(2_506628274631000502);

    function test_pdf_atMean() public pure {
        SD59x18 mu = sd(50e18);
        SD59x18 sigma = sd(5e18);
        SD59x18 result = GaussianMath.pdf(mu, mu, sigma);
        SD59x18 expected = sd(1e18).div(sigma.mul(SQRT_2PI));
        int256 diff = SD59x18.unwrap(result) - SD59x18.unwrap(expected);
        if (diff < 0) diff = -diff;
        assertLt(uint256(diff), 1e12);
    }

    function test_pdf_symmetry() public pure {
        SD59x18 mu = sd(50e18);
        SD59x18 sigma = sd(5e18);
        SD59x18 d = sd(3e18);
        SD59x18 left = GaussianMath.pdf(mu - d, mu, sigma);
        SD59x18 right = GaussianMath.pdf(mu + d, mu, sigma);
        int256 diff = SD59x18.unwrap(left) - SD59x18.unwrap(right);
        if (diff < 0) diff = -diff;
        assertLt(uint256(diff), 1e12);
    }

    function test_pdf_decreasesAwayFromMean() public pure {
        SD59x18 mu = sd(50e18);
        SD59x18 sigma = sd(5e18);
        SD59x18 atMean = GaussianMath.pdf(mu, mu, sigma);
        SD59x18 at1Sigma = GaussianMath.pdf(mu + sigma, mu, sigma);
        SD59x18 at2Sigma = GaussianMath.pdf(mu + sigma + sigma, mu, sigma);
        assertGt(SD59x18.unwrap(atMean), SD59x18.unwrap(at1Sigma));
        assertGt(SD59x18.unwrap(at1Sigma), SD59x18.unwrap(at2Sigma));
    }

    function test_l2Norm_decreasesWithSigma() public pure {
        SD59x18 small = GaussianMath.l2Norm(sd(5e18));
        SD59x18 large = GaussianMath.l2Norm(sd(10e18));
        assertGt(SD59x18.unwrap(small), SD59x18.unwrap(large));
    }

    function test_peak_decreasesWithSigma() public pure {
        SD59x18 _k = sd(1e18);
        SD59x18 small = GaussianMath.peak(_k, sd(5e18));
        SD59x18 large = GaussianMath.peak(_k, sd(10e18));
        assertGt(SD59x18.unwrap(small), SD59x18.unwrap(large));
    }

    function test_minSigma_increasesWithK() public pure {
        SD59x18 _b = sd(10e18);
        SD59x18 smallK = GaussianMath.minSigma(sd(1e18), _b);
        SD59x18 largeK = GaussianMath.minSigma(sd(2e18), _b);
        assertGt(SD59x18.unwrap(largeK), SD59x18.unwrap(smallK));
    }

    function test_minSigma_decreasesWithB() public pure {
        SD59x18 _k = sd(1e18);
        SD59x18 smallB = GaussianMath.minSigma(_k, sd(5e18));
        SD59x18 largeB = GaussianMath.minSigma(_k, sd(10e18));
        assertGt(SD59x18.unwrap(smallB), SD59x18.unwrap(largeB));
    }
}
