struct Descriptor {
    string *value<>;
    bool writable;
    string *get<>;
    string *set<>;
    bool configurable;
    bool enumerable;    
};

struct DescriptorEntry {
    string key<>;
    Descriptor descriptor;
};

struct Component {
    string id<>;
    string extends<>;
    string style<>;
    string template<>;
    DescriptorEntry descriptors<>;
};