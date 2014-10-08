CodeMirror.defineMode("erv", function () {

    var syntax = [];

    function registerSyntax (options) {
        syntax.push(options);
        return syntax[syntax.length - 1];
    }

    var eventTriggerPrefix = registerSyntax({
        token: 'keyword',
        regex: /^when a user/,
        sol: true,
        variableFollowsUntilEOL: true
    });

    var recurringTriggerOperator = registerSyntax({
        token: 'keyword',
        regex: /^ at/,
        variableFollowsUntilEOL: true
    });

    var recurringTriggerPrefix = registerSyntax({
        token: 'keyword',
        regex: /^every/,
        sol: true,
        variableFollowsUntil: recurringTriggerOperator
    });

    var oneOffTriggerPrefix = registerSyntax({
        token: 'keyword',
        regex: /^on the/,
        sol: true,
        variableFollowsUntilEOL: true
    });

    var sendStatementSuffix = registerSyntax({
        token: 'keyword',
        regex: /^ email/
    });

    var sendStatementPrefix = registerSyntax({
        token: 'keyword',
        regex: /^send the/,
        sol: true,
        variableFollowsUntil: sendStatementSuffix
    });

    var waitStatement = registerSyntax({
        token: 'keyword',
        regex: /^wait for/,
        sol: true,
        variableFollowsUntilEOL: true
    });

    registerSyntax({
        token: 'keyword',
        regex: /^if/,
        sol: true,
        variableFollowsUntilEOL: true
    });

    function tokenBase(stream, state) {

        var lookingFor, i;

        // possible state where we know the next token but just need to consume it
        if (state.nextToken) {
            lookingFor = state.nextToken;
            state.nextToken = null;
            state.lastToken = lookingFor;
            stream.match(lookingFor.regex);
            return lookingFor.token;
        }

        // check the lastToken match to see if it has further logic
        if (state.lastToken) {

            if (state.lastToken.variableFollowsUntilEOL) {
                stream.skipToEnd();
                state.lastToken = null;
                return 'string';
            }

            if (state.lastToken.variableFollowsUntil) {

                lookingFor = state.lastToken.variableFollowsUntil;
                state.lastToken = null;

                while (!stream.eol()) {

                    if (stream.match(lookingFor.regex, false)) {
                        state.nextToken = lookingFor;
                        return 'string';
                    }

                    stream.next();
                }

                stream.next();
                return 'string';
            }

        }

        // check known syntax
        for (i = 0; i < syntax.length; i++) {

            if (stream.match(syntax[i].regex)) {
                state.lastToken = syntax[i];
                return syntax[i].token;
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
