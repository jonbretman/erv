function onEditorContentChange(codeMirror) {

    var source = [];
    codeMirror.eachLine(function (line) {
        source.push(line.text);
    });
    source = source.join('\n').replace(/\t/g, '    ');

    var erv = Erv.fromString(source);
    document.getElementById('parsed').innerHTML = JSON.stringify(erv, null, '  ');
}

var editorContainer = document.getElementById('editor-container');

var cm = new CodeMirror(editorContainer, {
    mode: 'erv',
    tabSize: 4,
    indentWithTabs: false,
    indentUnit: 4
});

cm.on('change', onEditorContentChange);
