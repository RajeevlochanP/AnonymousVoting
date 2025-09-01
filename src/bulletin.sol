// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import "../lib/forge-std/src/console.sol";

contract Bulletin {
    address public owner;

    uint256 public g;
    uint256 public q;
    uint256 public p;
    uint256 public N;
    uint256 public base;
    uint8 internal state;
    uint256 public accum;
    struct Voter {
        bool registered;
        bool voted;
        uint256 X;
        uint256 h;
        uint256 Y;
    }

    struct Proof {
        uint256 r;
        uint256 d;
        uint256 a;
        uint256 b;
    }

    mapping(address => Voter) public voters;
    address[] public voterList;
    mapping(uint256 => address) public candidates;

    uint256 public candidateCount;

    event CandidateRegistered(
        uint256 indexed candidateId,
        address indexed candidateEOA
    );
    event VoterRegistered(address indexed eoca);
    event Voted(
        bytes32 indexed eoaHash,
        uint256 indexed candidateId,
        uint256 X
    );
    event OwnerChanged(address indexed oldOwner, address indexed newOwner);
    event voterSignupEvent(address indexed eoa, uint256 X);
    event stateChange(uint8 s);
    event VoteCast(address indexed voter, uint256 gX, uint256 Y);

    modifier onlyOwner() {
        require(msg.sender == owner, "Bulletin: only owner");
        _;
    }

    constructor(uint256 _g, uint256 _p, uint256 _q) {
        require(_q > 2, "q must be > 2");
        require(_q < _p, "q must be < p");
        require(_g > 1 && _g < _q, "g must be 2 <= g < q");
        owner = msg.sender;
        g = _g;
        q = _q;
        p = _p;
        state = 0;
        N=0;
        base=16;
    }

    function nextState() external onlyOwner {
        state = state + 1;
        console.log("New State", state);
        if (state == 2) {
            computeH();
        }
        if (state == 3) {
            tally();
        }
        // console.log(state);
        emit stateChange(state);
    }

    function registerCandidate(
        uint256 candidateId,
        address candidateEOA
    ) external onlyOwner {
        require(candidateEOA != address(0), "invalid candidate address");
        require(
            candidates[candidateId] == address(0),
            "candidateId already used"
        );
        candidates[candidateId] = candidateEOA;
        candidateCount += 1;
        emit CandidateRegistered(candidateId, candidateEOA);
    }

    function registerVoters(address[] memory accounts) external onlyOwner {
        for (uint256 i = 0; i < accounts.length; i++) {
            address voter = accounts[i];
            require(!voters[voter].registered, "voter already registered");
            voters[voter] = Voter({
                registered: true,
                voted: false,
                X: 0,
                h: 0,
                Y: 0
            });
            voterList.push(voter);
            emit VoterRegistered(voter);
        }
    }

    function changeOwner(address newOwner) external onlyOwner {
        require(newOwner != address(0), "invalid owner");
        address old = owner;
        owner = newOwner;
        emit OwnerChanged(old, newOwner);
    }

    /* ========== SIGNUP ========== */

    function modExp(
        uint256 base,
        uint256 exponent,
        uint256 modulus
    ) internal view returns (uint256 result) {
        bytes memory input = abi.encodePacked(
            uint256(32),
            uint256(32),
            uint256(32),
            base,
            exponent,
            modulus
        );
        bytes memory output = new bytes(32);
        bool success;
        assembly {
            success := staticcall(
                sub(gas(), 2000),
                5,
                add(input, 32),
                mload(input),
                add(output, 32),
                32
            )
        }
        require(success, "modexp failed");
        result = abi.decode(output, (uint256));
    }

    function voterSignup(
        uint256 X,
        uint256 gV,
        uint256 phi,
        uint256 n // n should be hash output, not uint256
    ) public {
        console.log(state, " : dfj");
        require(state == 1, "Not in signup phase");
        uint256 h = uint256(keccak256(abi.encodePacked(g, X, gV))) % q;
        require(n == h, "invalid n");
        require(X < p, "X not in the group");
        require(gV < p, "gV not in the group");
        require(voters[msg.sender].X == 0, "already sign up");

        // WARNING: (g ** phi) % q overflows for large phi
        // you need modular exponentiation instead
        uint256 lhs = gV;
        uint256 gP = modExp(g, phi, p);
        uint256 xN = modExp(X, n, p);
        uint256 rhs = mulmod(gP, xN, p);

        require(lhs == rhs, "Invalid Proof ");
        N++;

        voters[msg.sender].X = X;
        emit voterSignupEvent(msg.sender, X);
    }

    /* ========== VOTING ========== */

    function computeH() public {
        console.log("Running ComputeH");
        uint256 len = voterList.length;
        if (len == 0) return;

        uint256[] memory prefix = new uint256[](len);
        uint256[] memory suffix = new uint256[](len);

        // Compute prefix products
        uint256 temp = 1;
        for (uint256 i = 0; i < len; i++) {
            prefix[i] = temp;
            if (voters[voterList[i]].X != 0) {
                temp = mulmod(temp, voters[voterList[i]].X, p);
            }
        }

        // Compute suffix products
        temp = 1;
        for (uint256 j = len; j > 0; j--) {
            suffix[j - 1] = temp;
            if (voters[voterList[j - 1]].X != 0) {
                temp = mulmod(
                    temp,
                    modExp(voters[voterList[j - 1]].X, p - 2, p),
                    p
                );
            }
        }

        // Combine prefix and suffix for each h[i]
        for (uint256 k = 0; k < len; k++) {
            if (voters[voterList[k]].X != 0) {
                voters[voterList[k]].h = mulmod(prefix[k], suffix[k], p);
            } else {
                voters[voterList[k]].h = 0; // convention if X=0
            }
        }
    }

    /* ========== VOTING ========== */

    function vote(
        uint256 gX,
        uint256 Y,
        uint256 c,
        Proof[] memory proofs
    ) public {
        // 1. Pre-computation checks remain the same
        require(state == 2, "Bulletin: Not in voting phase");
        Voter storage voter = voters[msg.sender];
        require(voter.registered, "Bulletin: Not a registered voter");
        require(!voter.voted, "Bulletin: Already voted");
        require(voter.h != 0, "Bulletin: Voter's h-value not computed");
        require(
            proofs.length == candidateCount + 1,
            "Bulletin: Incorrect proof length"
        );

        // 2. Recomputing 'c' remains the same
        uint256 len = proofs.length;
        bytes memory packedData = abi.encodePacked(gX, Y);
        for (uint256 i = 0; i < len; i++) {
            packedData = abi.encodePacked(packedData, proofs[i].a, proofs[i].b);
        }
        uint256 recomputed_c = uint256(keccak256(packedData)) % q;
        require(recomputed_c == c, "Bulletin: Invalid challenge value c");

        // 3. Verifying sum of d's remains the same
        uint256 sumD = 0;
        for (uint256 i = 0; i < len; i++) {
            sumD = (sumD + proofs[i].d);
        }
        require(sumD % q == c, "Bulletin: Sum of d's does not match c");

        // 4. Verify each individual proof component.
        uint256 h = voter.h;
        for (uint256 i = 0; i < len; i++) {
            Proof memory proof = proofs[i];

            // === SCOPE 1: Check the 'a' component ===
            {
                uint256 lhs_a = mulmod(
                    modExp(g, proof.r, p),
                    modExp(gX, proof.d, p),
                    p
                );
                console.log("a : ", lhs_a);
                require(
                    lhs_a == proof.a,
                    "Bulletin: Proof validation failed for a"
                );
            } // 'lhs_a' is now off the stack

            // === SCOPE 2: Check the 'b' component ===
            {
                uint256 g_i = modExp(g, modExp(2, 4 * i, q), p); // NOTE: Corrected your g^i calculation
                uint256 g_i_inv = modExp(g_i, p - 2, p);
                uint256 Y_div_gi = mulmod(Y, g_i_inv, p);

                uint256 lhs_b = mulmod(
                    modExp(h, proof.r, p),
                    modExp(Y_div_gi, proof.d, p),
                    p
                );
                require(
                    lhs_b == proof.b,
                    "Bulletin: Proof validation failed for b"
                );
            } // All variables from this scope are now off the stack
        }

        // 5. Final steps remain the same
        voter.voted = true;
        voter.Y=Y;
        emit VoteCast(msg.sender, gX, Y);
    }

    function tally() public {
        uint256 len=voterList.length;
        uint256 accumulator=1;
        for(uint256 i=0;i<len;i++){
            console.log("Y :",voters[voterList[i]].Y);
            accumulator=mulmod(accumulator,voters[voterList[i]].Y,p);
        }
        console.log("accum : ",accumulator);
        accum=accumulator;
    } 

    // function vote(uint256 candidateId, uint256 X) external {
    //     bytes32 k = keyOf(msg.sender);
    //     Voter storage v = voters[k];
    //     require(v.registered, "not registered as voter");
    //     require(!v.voted, "already voted");
    //     require(candidates[candidateId] != address(0), "invalid candidate");

    //     // OPTIONAL: enforce the provided X equals registered X (if you want that policy)
    //     // require(v.X == X, "X mismatch");

    //     // record vote
    //     v.voted = true;
    //     v.X = X; // store/overwrite X if desired
    //     emit Voted(k, candidateId, X);
    // }

    // /* ========== VIEW HELPERS ========== */

    // /// @notice get voter info by EOA
    // function getVoterInfo(
    //     address eoa
    // ) external view returns (bool registered, bool voted, uint256 X) {
    //     Voter storage v = voters[keyOf(eoa)];
    //     return (v.registered, v.voted, v.X);
    // }

    // /// @notice convenience: fetch candidate EOA for id
    // function getCandidate(uint256 candidateId) external view returns (address) {
    //     return candidates[candidateId];
    // }
}
