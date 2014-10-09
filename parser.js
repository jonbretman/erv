var syntax = [];

syntax.push(['EventTriggerStatement', /^when a user (.*?)$/i, function (eventName) {
    return {
        eventName: eventName
    };
}]);

syntax.push(['TimeTriggerStatement', /^every (.*?) at (.*?)$/i, function (days, times) {
    return {
        days: commaSentenceToArray(days),
        times: commaSentenceToArray(times)
    };
}]);

syntax.push(['SendEmailStatement', /^send (.*?) email(| with custom fields)$/i, function (template, customFields) {
    return {
        template: template,
        customFields: !!customFields.trim()
    };
}]);

syntax.push(['WaitStatement', /^wait for (.*?) days$/i, function (days) {
    return {
        days: parseInt(days, 10)
    };
}]);

syntax.push(['ConditionStatement', /^if (.*?)$/i, function (condition) {
    return {
        condition: condition
    };
}]);

function commaSentenceToArray(str) {
   return str.split(/,| and /).map(function (s) {
       return s.trim();
   });
}

function Step (definition, line) {
    this.definition = definition;
    this.line = line;
    if (this['_process' + definition.type]) {
        this['_process' + definition.type]();
    }
}

Step.prototype = {

    _processSendEmailStatement: function () {

        if (!this.line.children.length) {
            return;
        }

        this.definition.customFields = this.line.children.map(function (line) {

            var match = line.stripped.match(/^([a-zA-Z0-9 ]+) *: *(.*?)$/);

            if (!match) {
                var err = new Error('StepParseError');
                err.line = line;
                throw err;
            }

            return {
                key: match[1],
                value: match[2]
            };

        }.bind(this));

    }

};

function Line (source, lineNo) {
    this.source = source.replace(/\t/g, '    ');
    this.lineNo = lineNo;
    this.stripped = source.trim();
    this.children = [];

    for (var i = 0, count = 0; i < this.source.length; i++) {

        if (this.source[i] === ' ') {
            count++;
        }

        else {
            break;
        }

    }

    this.indent = Math.floor(count / 4);
}

Line.prototype = {

    toStep: function () {

        for (var i = 0; i < syntax.length; i++) {

            var type = syntax[i];
            var match = this.stripped.match(type[1]);

            if (match) {

                var def = type[2].apply(null, match.slice(1));
                def.type = type[0];

                return new Step(def, this);
            }
        }

        var err = new Error('StepParseError');
        err.line = this;
        err.reason = 'Unknown syntax';
        throw err;
    }

};

function getRawTreeFromLines(lines) {

    var line;
    var result = [];
    var context = [result];
    var lastIndent = 0;

    for (var i = 0; i < lines.length; i++) {

        line = new Line(lines[i], i + 1);

        if (!line.stripped) {
            continue;
        }

        if (line.indent < lastIndent) {
            context.pop();
        }

        if (line.indent > lastIndent) {
            var parentContext = context[context.length - 1].slice(-1)[0];

            if (!parentContext) {
                var err = new Error('StepParseError');
                err.line = line;
                err.reason = 'Indentation without parent context.';
                throw err;
            }

            context.push(context[context.length - 1].slice(-1)[0].children);
        }

        context[context.length - 1].push(line);
        lastIndent = line.indent;
    }

    return result;
}

function parse(lines) {
    var rawTree = getRawTreeFromLines(lines);

    var ast = rawTree.map(function (line) {
        return line.toStep();
    });

    return ast.map(function (step) {
        return step.definition;
    });
}

function onEditorContentChange(codeMirror) {

    var lines = [];
    var ast;

    codeMirror.eachLine(function (line) {
        lines.push(line.text);
    });

    try {
        ast = parse(lines);
    } catch (e) {
        if (e.message === 'StepParseError') {
            // invalid syntax - highlight in editor
            ast = {
                error: e.message,
                lineNo: e.line.lineNo,
                reason: e.reason,
                source: e.line.source
            };
        }
        else {
            // some other error :(
            throw e;
        }
    }

    document.getElementById('parsed').innerHTML = JSON.stringify(ast, null, '  ');
}

var editorContainer = document.getElementById('editor-container');

var cm = new CodeMirror(editorContainer, {
    mode: 'erv',
    tabSize: 4,
    indentWithTabs: false,
    indentUnit: 4
});

cm.on('change', onEditorContentChange);
