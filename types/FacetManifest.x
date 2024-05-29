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
    bool expressionIncludesValueAsVariable;
    bool hasDefault;
    bool returnFullRequest;
};

struct VarsPattern {
    string expression<>;
    string regexp<>;
};

struct VarsProxy {
    string *childArgs<>;
    string *childMethodName<>;
    string parentArgs<>;
    string parentObjectName<>;
    bool useHelper;
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

union Step switch(HandlerType handler) {
    case json: 
        string *defaultExpression<>;
        VarsJson vars;
    case network: 
        string *defaultExpression<>;
        VarsNetwork vars;
    case pattern: 
        string *defaultExpression<>;
        VarsPattern vars;
    case proxy: 
        string *defaultExpression<>;
        VarsProxy vars;
    case router:
        string *defaultExpression<>;
    case routerhash: 
        string *defaultExpression<>;
    case routersearch: 
        string *defaultExpression<>;
    case routerpathname:
        string *defaultExpression<>;
    case selector:
        string *defaultExpression<>;
        VarsSelector vars;
    case state:
        string *defaultExpression<>;
        VarsState vars;
    case string:
        string *defaultExpression<>;
        VarsExpression vars;
    case transform:
        string *defaultExpression<>;
        VarsExpression vars;
    case variable:
        string *defaultExpression<>;
        VarsExpression vars;
    case wait:
        string *defaultExpression<>;
        VarsExpression vars;
};



struct Step {
    bool binder<>;
    string *defaultExpression<>;
    HandlerType handler<>;
    string label<>;
    LabelMode *labelMode;
    Vars vars;
};

struct Statement {
    Name labels<>;
    Step steps<>;
};

struct FacetManifest {
    Name cellNames<>;
    Name fieldNames<>;
    string hash[64];
    Statement statements<>;
};
