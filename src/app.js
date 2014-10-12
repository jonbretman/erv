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
        gutters: ['error-markers']
    });
    cm.on('change', onEditorContentChange);
}

init();
