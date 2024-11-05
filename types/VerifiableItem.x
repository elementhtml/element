enum SegmentType {
    INLINE_DATA = 0,     // Direct inline byte data up to 40 bytes
    CHUNK_ADDRESS = 1,       // Reference to a 1MB block and a byte range
    OBJECT_ADDRESS = 2          // Reference to a nested object manifest
};

struct InlineData {
    opaque data<40>;        // Inline byte data, maximum of 40 bytes
};

struct ChunkAddress {
    opaque blockAddress[32];    // SHA-256 hash of the referenced block
    uint32 sliceStart;       // Start byte within the block (0 to 1,048,575)
    uint32 sliceEnd;         // End byte within the block (0 to 1,048,575)
};

union ManifestSegment switch (SegmentType type) {
    case INLINE_DATA:
        InlineData inlineData;

    case CHUNK_ADDRESS:
        ChunkAddress chunkAddress;

    case OBJECT_ADDRESS:
        ChunkAddress objectAddress; // SHA-256 hash of the nested object manifest
};

struct SelfVerifyingObject {
    string contentType<>;            // Content type of the object (e.g., "application/json")
    ManifestSegment segments<>;      // Array of segments to build the object
};

struct Rule {
    string ruleKey<>;               // Arbitrary key for the rule
    ChunkAddress ruleFunction[40];      // SHA-256 hash of the object defining the rule - must be either a JS or WASM module
};

struct Transaction {
    uint64 timestamp;               // Timestamp of the transaction
    string ruleKey<>;               // Key of the rule used for the computation
    ManifestSegment input[40];           // SHA-256 hash of the input object
    ManifestSegment resultState[40];           // SHA-256 hash of the resulting state object
};

struct Contract {
    Rule rules<>;                   // Array of permissible rules (with rule key and object hash)
    Transaction ledger<>;           // Ordered array of transactions for historical record
};
