typedef string Name<>;

struct AttributesConfig {
    Name observed<>;
};

struct ComponentConfig {
    bool openShadow;
};

struct EventsConfig {
    Name *default;
};

struct PropertiesConfig {
    Name flattenable<>;
    Name *value;
};

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
    AttributesConfig attributes;
    ComponentConfig config;
    EventsConfig events
    string extends<>;
    string id<>;
    PropertiesConfig properties;
    string style<>;
    Name subspaces<>;
    string template<>;
    DescriptorEntry descriptors<>;
};