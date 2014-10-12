var emailTemplates = [
    'Welcome to Lyst',
    'Essentials for You',
    'Recommended for You',
    'Lyst Life',
    'Back in Stock Notification',
    'Icon Purchase Confirmation'
].map(function (template) {
    return {
        text: template + ' email',
        displayText: template
    };
});

var eventTypes = [
    'registers',
    'makes a purchase',
];

var conditions = [
    'the user has been active in the last 90 days',
    'the user has made a purchase in the last 30 days',
    'the user is female',
    'the user is male'
];

/**
 *
 * @param codeMirror
 * @param options
 */
function getAutoCompletionHints(codeMirror, options) {
    return {
        list: options.hintsList,
        from: codeMirror.doc.getCursor(),
        to: codeMirror.doc.getCursor()
    };
}

/**
 *
 * @param codeMirror
 */
function updateAutoComplete(codeMirror) {
    var cursor = codeMirror.doc.getCursor();
    var token = codeMirror.getTokenAt(cursor);
    var hintsList = [];

    if (token.state.lastToken === 'keyword' && token.type === null && token.string === ' ') {
        switch (token.state.lastKeyword) {
            case 'EventTriggerStatement':
                hintsList = eventTypes;
                break;
            case 'SendStatementPrefix':
                hintsList = emailTemplates;
                break;
            case 'ConditionStatement':
                hintsList = conditions;
        }
    }

    codeMirror.showHint({
        hintsList: hintsList
    });
}

/**
 * Creates an error marker element.
 * @param message The error message to be shown when the user hovers over the marker
 * @returns {HTMLElement}
 */
function makeErrorMarker(message) {
    var errorMarker = document.createElement("div");
    errorMarker.className = 'error-marker';

    var errorMarkerText = document.createElement('span');
    errorMarkerText.className = 'error-marker-text';
    errorMarkerText.textContent = message;

    errorMarker.appendChild(errorMarkerText);
    return errorMarker;
}

/**
 * Handler for the content of the editor changing.
 * @param {CodeMirror} codeMirror
 */
function onEditorContentChange(codeMirror) {

    var source = [];
    codeMirror.eachLine(function (line) {
        source.push(line.text);
    });
    source = source.join('\n').replace(/\t/g, '    ');

    var erv = Erv.fromString(source);

    codeMirror.clearGutter('error-markers');

    if (erv.errors.length) {
        erv.errors.forEach(function (error) {
            codeMirror.setGutterMarker(error.line.lineNo, 'error-markers', makeErrorMarker(error.message));
        });
    }

    updateAutoComplete(codeMirror);

    document.getElementById('parsed').innerHTML = JSON.stringify(erv, null, '  ');
}

/**
 * Initialises the editor and listening for 'change' events.
 */
function init() {
    var cm = new CodeMirror(document.getElementById('editor-container'), {
        mode: 'erv',
        tabSize: 4,
        indentWithTabs: false,
        indentUnit: 4,
        lineNumbers: true,
        gutters: ['error-markers'],
        hintOptions: {
            hint: getAutoCompletionHints
        }
    });
    cm.on('change', onEditorContentChange);
    return cm;
}

var cm = init();
