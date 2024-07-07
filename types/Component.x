typedef string Name<>;

struct Attributes {
    Name observed<>;
};

struct Config {
    
};

struct Component {
    Attributes *attributes;
    Config *config;
    string class<>;
    string *extends<>;
    string *native<>;
    string *id<>;
    string style<>;
    string template<>;
};