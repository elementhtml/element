enum SegmentType {
    RAW_BYTE_SEQUENCE = 0,     // Direct inline byte data up to 40 bytes
    BLOCK_REFERENCE = 1,       // Reference to a 1MB block and a byte range
    NESTED_OBJECT = 2          // Reference to a nested object manifest
};

struct InlineData {
    opaque data<40>;        // Inline byte data, maximum of 40 bytes
};

struct BlockReference {
    opaque blockHash[32];    // SHA-256 hash of the referenced block
    uint32 sliceStart;       // Start byte within the block (0 to 1,048,575)
    uint32 sliceEnd;         // End byte within the block (0 to 1,048,575)
};

union ManifestSegment switch (SegmentType type) {
    case RAW_BYTE_SEQUENCE:
        InlineData rawData;

    case BLOCK_REFERENCE:
        BlockReference blockRef;

    case NESTED_OBJECT:
        BlockReference nestedObjectHash[32]; // SHA-256 hash of the nested object manifest
};

struct ObjectManifest {
    string contentType<>;            // Content type of the object (e.g., "application/json")
    ManifestSegment segments<>;      // Array of segments to build the object
};
