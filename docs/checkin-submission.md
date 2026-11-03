# Final submission: text to paste on DoraHacks

Dán phần tiếng Anh bên dưới vào ô mô tả dự án.

---

**Bond Market: a prediction market resolved by a bond war. No oracle, no admin.**

Anyone can create a Yes/No question and bet on it with the native token. After betting closes, anyone can post a bond on Yes or No during a resolution window. When the window ends, the side with the larger total bond wins. Winners share the bet pool in proportion to their bets and the bond pool in proportion to their bonds. If bonds tie, or nobody bonds for 7 days, everyone is refunded. The contract has five state-changing functions and no owner, no admin and no fee.

Lying is expensive: to push a wrong result you must out-bond everyone who disagrees, and they profit by doing so. A bond posted in the last quarter of the window extends it by a quarter, so the other side always has time to answer.

**Links**
- Demo video: https://www.youtube.com/watch?v=1qliOvD-X04
- Pitch deck: https://github.com/QuyTu9868/bond-market-portaldot/blob/main/docs/pitch/bond-market-pitch-deck.pdf
- Source code: https://github.com/QuyTu9868/bond-market-portaldot
- Live app: https://bond-market-portaldot.onrender.com/ (Portaldot V3 testnet, MetaMask needed)

**Deployed on Portaldot V3 testnet (chain ID 420420777)**
- Public test deployment, 1 hour resolution window: `0x52AdCE6b8A11E8FbfA57c435B99e57d4835B84c3` (deploy tx `0x15f802a2cdf0772811dba1647c247336ed0c3acd0362d6c17239ae6f56febbda`)
- Demo deployment, 60 second resolution window (used for the video and automated tests): `0xA0E8abFC1fD958e5900b87963B4c460F980ef86C` (deploy tx `0xee5935a9a5b72262094561c442057d72e27ea69eb4b36228506d85ca4d9eaba0`)
- Both run the same code. Only the constructor argument for the window differs. All transaction hashes are in the README.

**What is built**
- `PredictionMarket.sol` (Solidity 0.8.28, Hardhat, OpenZeppelin ReentrancyGuard): create, bet, bond, finalize, claim, refunds, late-bond protection, market categories. 31 unit tests passing. Slither: no high or medium findings.
- Web app (Next.js, wagmi, MetaMask) with light and dark themes: market list with live countdowns and Yes/No bars, search, category filter and sort, a shareable page per market, a Portfolio page with positions and claimable amounts, payout estimate, an activity chart read from chain events, and press-and-hold confirmation for every bet and bond. Every transaction shows waiting for signature, confirming, done, or a readable error.
- End-to-end tests through the real web app: a local chain suite, and a testnet suite with two wallets that ran both a bond war with a winner and a bond tie with refunds on Portaldot testnet.

**What we learned on Portaldot**
- Fees on pallet_revive are dominated by storage deposits: deploying cost about 400 tPOT, and one full test run about 85 tPOT per wallet. Contract size and storage writes matter on this chain, which is why v2 is 21 percent smaller than v1.
- The public RPC sometimes answers with 503 or an HTML page, and the chain once stopped producing blocks for over an hour. The app polls less and retries reads, and shows a clear message for these cases.

**Known limits**
- A very rich actor can win a bond war, but must out-bond all other bonders combined. Payouts are pool-sharing (parimutuel), with no live price like Polymarket.
- The resolution window is fixed at deployment (60 seconds or 1 hour here). Not audited. Testnet only, do not use real funds.
- Most of the code was written with Claude (Anthropic) under the project owner's design decisions. This is disclosed in the README.
