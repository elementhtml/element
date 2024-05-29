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
        string label<>;
        LabelMode *labelMode;
        VarsJson vars;
    case network: 
        string *defaultExpression<>;
        string label<>;
        LabelMode *labelMode;
        VarsNetwork vars;
    case pattern: 
        bool binder<>;
        string *defaultExpression<>;
        string label<>;
        LabelMode *labelMode;
        VarsPattern vars;
    case proxy: 
        bool binder<>;
        string *defaultExpression<>;
        string label<>;
        LabelMode *labelMode;
        VarsProxy vars;
    case router:
        string *defaultExpression<>;
        string label<>;
        LabelMode *labelMode;
    case routerhash: 
        string *defaultExpression<>;
        string label<>;
        LabelMode *labelMode;
    case routersearch: 
        string *defaultExpression<>;
        string label<>;
        LabelMode *labelMode;
    case routerpathname:
        string *defaultExpression<>;
        string label<>;
        LabelMode *labelMode;
    case selector:
        bool binder<>;
        string *defaultExpression<>;
        string label<>;
        LabelMode *labelMode;
        VarsSelector vars;
    case state:
        bool binder<>;
        string *defaultExpression<>;
        string label<>;
        LabelMode *labelMode;
        VarsState vars;
    case string:
        string *defaultExpression<>;
        string label<>;
        LabelMode *labelMode;
        VarsExpression vars;
    case transform:
        string *defaultExpression<>;
        string label<>;
        LabelMode *labelMode;
        VarsExpression vars;
    case variable:
        string *defaultExpression<>;
        string label<>;
        LabelMode *labelMode;
        VarsExpression vars;
    case wait:
        string *defaultExpression<>;
        string label<>;
        LabelMode *labelMode;
        VarsExpression vars;
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
