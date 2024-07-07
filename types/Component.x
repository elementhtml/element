typedef string Name<>;

struct Attributes {
    Name observed<>;
};

struct Config {
    bool openShadow;
};

struct Events {
    string *default<>;
};

struct Properties {
    Name flattenable<>;
    string *value<>;
};

struct Component {
    Attributes *attributes;
    string *class<>;
    Config *config;
    Events *events;
    string *extends<>;
    string *native<>;
    string *id<>;
    Properties *properties;
    string *style<>;
    Name *subspaces<>;
    string *template<>;
};