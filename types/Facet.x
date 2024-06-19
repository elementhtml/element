typedef string JsonEncodedValue<>;

typedef string Name<>;

enum LabelMode { force = 1, silent = 2 };

enum HandlerType { 
    json = 1, 
    network = 2, 
    pattern = 3, 
    proxy = 4, 
    router = 5, 
    routerhash = 6, 
    routersearch = 7, 
    routerpathname = 8, 
    selector = 9, 
    state = 10, 
    string = 11, 
    transform = 12, 
    variable = 13, 
    wait = 14
};

struct VarsJson {
    string value<>;
};

struct VarsNetwork {
    string expression<>;
    bool expressionIncludesVariable;
    bool hasDefault;
    bool returnFullRequest;
};

struct VarsPattern {
    string expression<>;
};

struct VarsProxy {
    JsonEncodedValue *childArgs<>;
    Name *childMethodName;
    bool hydrate;
    JsonEncodedValue parentArgs<>;
    Name parentObjectName;
    bool useHelper;
};

struct VarsRouterHash {
    bool signal;
};

struct VarsSelector {
    string scopeStatement<>;
    string selectorStatement<>;
    bool signal;
};

struct VarsState {
    string expression<>;
    bool signal;
    string typeDefault[1];
};

struct VarsExpression {
    string expression<>;
};



struct CtxJson {
    VarsJson vars;        
};

struct CtxNetwork {
    VarsNetwork vars;
};

struct CtxPattern {
    bool binder;
    VarsPattern vars;
};

struct CtxProxy {
    bool binder;
    VarsProxy vars;
};

struct CtxRouterHash {
    bool binder;
    VarsRouterHash vars;
};

struct CtxSelector {
    bool binder;
    VarsSelector vars;
};

struct CtxState {
    bool binder;
    VarsState vars;
};

struct CtxExpression {
    VarsExpression vars;        
};

union Params switch(HandlerType handler) {
    case json: 
        CtxJson ctx;
    case network: 
        CtxNetwork ctx;
    case pattern: 
        CtxPattern ctx;
    case proxy: 
        CtxProxy ctx;
    case routerhash: 
        CtxRouterHash ctx;
    case routersearch: 
        void;
    case routerpathname:
        void;
    case router:
        void;
    case selector:
        CtxSelector ctx;
    case state:
        CtxState ctx;
    case string:
        CtxExpression ctx;
    case transform:
        CtxExpression ctx;
    case variable:
        CtxExpression ctx;
    case wait:
        CtxExpression ctx;
};

struct Step {
    string *defaultExpression<>;
    Name label;
    LabelMode *labelMode;
    Params params;
};

struct Statement {
    Name labels<>;
    Step steps<>;
};

struct Facet {
    Name cellNames<>;
    Name fieldNames<>;
    string cid[59];
    Statement statements<>;
};
