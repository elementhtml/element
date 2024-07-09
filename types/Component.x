typedef string Name<>;

struct Attributes {
    Name observed<>;
};

struct Config {
    bool openShadow;
};

struct Events {
    Name *default;
};

struct Properties {
    Name flattenable<>;
    Name *value;
};

struct Component {
    Attributes *attributes;
    string *class<>;
    Config *config;
    Events *events;
    Name *extends;
    Name *native;
    bool *lite;
    Properties *properties;
    string *style<>;
    Name *subspaces<>;
    string *template<>;
};