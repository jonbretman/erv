CodeMirror.defineMode("erv", function () {

    var keywords = {

        'EventTriggerPrefix': {
            regex: /^when a user/,
            variableFollowsUntilEOL: true
        },

        'RecurringTriggerOperator': {
            regex: /^ at/,
            variableFollowsUntilEOL: true
        },

        'RecurringTriggerPrefix': {
            regex: /^every/,
            variableFollowsUntil: 'RecurringTriggerOperator'
        },

        'OneOffTriggerPrefix': {
            regex: /^on the/,
            variableFollowsUntilEOL: true
        },

        'SendStatementSuffix': {
            regex: /^ email/
        },

        'SendStatementPrefix': {
            regex: /^send the/,
            variableFollowsUntil: 'SendStatementSuffix'
        },

        'WaitStatement': {
            regex: /^wait for/,
            variableFollowsUntilEOL: true
        },

        'ConditionStatement': {
            regex: /^if/,
            variableFollowsUntilEOL: true
        },

        'TemplateParameterKey': {
            regex: /^[^:]*:/,
            token: 'variable-2',
            variableFollowsUntilEOL: 'variable-3',
            requiresIndent: true
        }

    };

    var TOKEN_STRING = 'string';
    var TOKEN_KEYWORD = 'keyword';

    function nextTokenKnown(stream, state) {
        var lookingFor = state.nextToken;
        state.nextToken = null;
        state.lastToken = lookingFor;
        stream.match(lookingFor.regex);
        state.tokenize = tokenBase;
        return [lookingFor.token || TOKEN_KEYWORD, lookingFor.type].join(' ');
    }

    function variableUntilEndOfLine(stream, state) {
        stream.skipToEnd();
        var token = state.lastToken.variableFollowsUntilEOL;
        state.lastToken = null;
        return typeof token === 'string' ? token : TOKEN_STRING;
    }

    function variableUntilNextKeyword(stream, state) {
        var lookingFor = keywords[state.lastToken.variableFollowsUntil];
        lookingFor.type = state.lastToken.variableFollowsUntil;
        state.lastToken = null;

        while (!stream.eol()) {

            if (stream.match(lookingFor.regex, false)) {
                state.nextToken = lookingFor;
                return TOKEN_STRING;
            }

            stream.next();
        }

        stream.next();
        return TOKEN_STRING;
    }

    function tokenBase(stream, state) {

        // possible state where we know the next token but just need to consume it
        if (state.nextToken) {
            return nextTokenKnown(stream, state);
        }

        // check the lastToken match to see if it has further logic
        if (state.lastToken) {

            // check if rest of the line is a literal
            if (state.lastToken.variableFollowsUntilEOL) {
                return variableUntilEndOfLine(stream, state);
            }

            // check if there is a literal only until another keyword is found
            if (state.lastToken.variableFollowsUntil) {
                return variableUntilNextKeyword(stream, state);
            }

        }

        for (var key in keywords) {

            if (keywords[key].requiresIndent && stream.indentation() === 0) {
                continue;
            }

            if (stream.match(keywords[key].regex)) {
                state.lastToken = keywords[key];
                state.lastToken.type = key;
                return [keywords[key].token || TOKEN_KEYWORD, key].join(' ');
            }

        }

        // advance stream
        stream.next();
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
