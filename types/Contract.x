struct Rule {
    string ruleKey<>;               // Arbitrary key for the rule
    opaque ruleObjectHash[32];      // SHA-256 hash of the object defining the rule
};

struct Transaction {
    uint64 timestamp;               // Timestamp of the transaction
    string ruleKey<>;               // Key of the rule used for the computation
    opaque inputHash[32];           // SHA-256 hash of the input object
    opaque stateHash[32];           // SHA-256 hash of the resulting state object
};

struct Contract {
    Rule rules<>;                   // Array of permissible rules (with rule key and object hash)
    Transaction ledger<>;           // Ordered array of transactions for historical record
};
