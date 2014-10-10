CodeMirror.defineMode("erv", function () {

    var TOKEN_KEYWORD = 'keyword';
    var TOKEN_STRING = 'string';
    var TOKEN_CUSTOM_FIELD_KEY = 'variable-2';
    var TOKEN_CUSTOM_FIELD_VALUE = 'variable-3';

    var SEND_STATEMENT_PREFIX = 'SendStatementPrefix';
    var SEND_STATEMENT_SUFFIX = 'SendStatementSuffix';
    var CUSTOM_FIELD_KEY = 'CustomFieldKey';
    var EVENT_TRIGGER_STATEMENT = 'EventTriggerStatement';
    var TIME_TRIGGER_STATEMENT = 'TimeTriggerStatement';
    var TIME_TRIGGER_OPERATOR = 'TimeTriggerOperator';
    var WAIT_STATEMENT = 'WaitStatement';
    var CONDITION_STATEMENT = 'ConditionStatement';

    var END_OF_LINE = 'EOL';

    var lastToken = null;

    function ret(token) {
        lastToken = token;
        return token;
    }

    function tokenBase(stream, state) {

        var ch = stream.peek();

        // clear last token at the start of each line
        if (stream.sol()) {
            lastToken = null;
        }

        // ignore whitespace
        if (ch === ' ') {
            stream.next();
            return null;
        }

        // support for multi-line custom field values
        if (state.lastKeyword === CUSTOM_FIELD_KEY) {

            if (lastToken === TOKEN_CUSTOM_FIELD_KEY && ch === ':') {
                stream.next();
                return null;
            }
            else if (lastToken || stream.indentation() > state.customFieldIndent) {
                stream.skipToEnd();
                return TOKEN_CUSTOM_FIELD_VALUE;
            }

            // custom field value has finished - clear the indent value
            state.customFieldIndent = null;
        }

        // support unquoted dynamic input
        if (state.acceptStringUntil) {
            switch (state.acceptStringUntil) {

                case SEND_STATEMENT_SUFFIX:
                    if (stream.match(/^email/) && stream.eol()) {
                        state.acceptStringUntil = null;
                        return ret(TOKEN_KEYWORD);
                    }
                    break;

                case TIME_TRIGGER_OPERATOR:
                    if (stream.match(/^at/)) {
                        state.acceptStringUntil = END_OF_LINE;
                        return ret(TOKEN_KEYWORD);
                    }
                    break;

                case END_OF_LINE:
                    stream.skipToEnd();
                    state.acceptStringUntil = null;
                    return ret(TOKEN_STRING);

            }

            stream.next();
            return ret(TOKEN_STRING);
        }

        if (stream.sol() && stream.match(/^send the/i)) {
            state.lastKeyword = SEND_STATEMENT_PREFIX;
            state.acceptStringUntil = SEND_STATEMENT_SUFFIX;
            return ret(TOKEN_KEYWORD);
        }

        if (stream.sol() && stream.match(/^every/i)) {
            state.lastKeyword = TIME_TRIGGER_STATEMENT;
            state.acceptStringUntil = TIME_TRIGGER_OPERATOR;
            return ret(TOKEN_KEYWORD);
        }

        if (stream.sol() && stream.match(/^wait for/i)) {
            state.lastKeyword = WAIT_STATEMENT;
            state.acceptStringUntil = END_OF_LINE;
            return ret(TOKEN_KEYWORD);
        }

        if (stream.sol() && stream.match(/^if/i)) {
            state.lastKeyword = CONDITION_STATEMENT;
            state.acceptStringUntil = END_OF_LINE;
            return ret(TOKEN_KEYWORD);
        }

        if (stream.sol() && stream.match(/^when a user/i)) {
            state.lastKeyword = EVENT_TRIGGER_STATEMENT;
            state.acceptStringUntil = END_OF_LINE;
            return ret(TOKEN_KEYWORD);
        }

        if (stream.indentation() > 0 && stream.match(/^[^:]*/)) {
            state.lastKeyword = CUSTOM_FIELD_KEY;
            state.customFieldIndent = stream.indentation();
            return ret(TOKEN_CUSTOM_FIELD_KEY);
        }

        stream.next();
        return null;
    }

    return {

        startState: function () {
            return {
                tokenize: tokenBase
            };
        },

        token: function (stream, state) {
            return state.tokenize(stream, state);
        }

    };

});
