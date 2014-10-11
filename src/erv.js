function Erv(campaign) {
    this.campaign = campaign || null;
    this.ast = [];
    this.programString = '';
    this.errors = [];
}

Erv.prototype = {

    setProgramString: function (str) {

        this.programString = str;
        this.ast = [];

        var ast = this.ast;
        var lines = str.split('\n');
        var line;
        var context = [ast];
        var lastIndent = 0;
        var i = 0;
        var j = 0;

        function last(arr) {
            return arr[arr.length - 1];
        }

        for (; i < lines.length; i++) {

            line = this._astLineFromString(lines[i], i + 1);

            if (!line.source) {
                continue;
            }

            if (line.indent < lastIndent) {
                for (j = 0; j < lastIndent - line.indent; j++) {
                    context.pop();
                }
            }

            if (line.indent > lastIndent) {
                var parentContext = last(last(context));

                if (!parentContext) {
                    this.errors.push({
                        line: line,
                        message: 'Indentation is not allowed here.'
                    });
                    ast.push(line);
                    break;
                }

                context.push(parentContext.children);
            }

            last(context).push(line);
            lastIndent = line.indent;
        }


        this._setCampaignFromAstLine(ast[0]);
        this._setCampaignStepsFromAstLines(ast.slice(1));
        return this;
    },

    _astLineFromString: function (str, lineNo) {

        // replace tabs with 4 spaces
        str = str.replace(/\t/g, '    ');

        // calculate the indent
        for (var i = 0, count = 0; i < str.length; i++) {
            if (str[i] !== ' ') {
                break;
            }
            count++;
        }

        return {
            lineNo: lineNo,
            source: str.trim(),
            children: [],
            indent: Math.floor(count / 4)
        };
    },

    _setCampaignFromAstLine: function (astLine) {

        var campaign = this.campaign = {
            steps: []
        };

        if (!astLine) {
            this.errors.push({
                line: astLine,
                message: 'A campaign must start with a valid trigger eg. "when", "on", or "at"'
            });
            return this;
        }

        var str = astLine.source;

        if (!str) {
            this.errors.push({
                line: astLine,
                message: str + ' is not a valid campaign trigger.'
            });
            return this;
        }

        var match = str.match(/^when a user (.*?)$/i);
        if (match) {
            campaign.eventType = match[1];
            campaign.type = 'E';
            return this;
        }

        match = str.match(/^every (.*?) at (.*?)$/i);
        if (match) {
            campaign.type = 'P';
            try {
                campaign.weekdays = this._parseWeekdays(match[1]);
            }
            catch (e) {
                this.errors.push({
                    line: astLine,
                    message: e.message
                });
            }
            try {
                campaign.hours = this._parseTimes(match[2]);
            }
            catch (e) {
                this.errors.push({
                    line: astLine,
                    message: e.message
                });
            }
            return this;
        }

        match = str.match(/on ([\d\/]+) at (.*?)$/i);
        if (match) {
            campaign.type = 'O';
            campaign.localDatetime = match[1] + ' ' + match[2];
            return this;
        }

        this.errors.push({
            line: astLine,
            message: str + ' is not a valid campaign trigger.'
        });
        return this;
    },

    _setCampaignStepsFromAstLines: function (astLines) {
        this.campaign.steps = astLines.map(this._stepFromAstLine.bind(this));
        return this;
    },

    _stepFromAstLine: function (astLine) {
        var campaignStep = {};

        var match = astLine.source.match(/^send the (.*?) email$/);
        if (match) {
            campaignStep.type = 'email';
            campaignStep.emailTemplate = match[1].toLowerCase().replace(/ /g, '_');
            campaignStep.emailTemplateParams = astLine.children.map(this._parseEmailTemplateParamAst.bind(this));
            return campaignStep;
        }

        match = astLine.source.match(/^if (.*?)$/);
        if (match) {
            campaignStep.type = 'condition';
            campaignStep.conditionFunction  = match[1].toLowerCase().replace(/ /g, '_');
            return campaignStep;
        }

        match = astLine.source.match(/^wait for (.*?) (.*?)$/i);
        if (match) {
            campaignStep.type = 'wait';
            var unit = match[2].toLowerCase();
            var multiplier;
            switch (unit) {
                case 'mins':
                case 'minute':
                case 'minutes':
                    multiplier = 1;
                    break;
                case 'hour':
                case 'hours':
                    multiplier = 60;
                    break;
                case 'day':
                case 'days':
                    multiplier = 60 * 24;
                    break;
                default :
                    this.errors.push({
                        line: astLine,
                        message: unit + ' is not a valid wait unit.'
                    });
                    return campaignStep;

            }

            var n = parseInt(match[1], 10);
            if (isNaN(n)) {
                this.errors.push({
                    line: astLine,
                    message: n + ' is not a valid wait amount.'
                });
                return campaignStep;
            }

            campaignStep.waitMinutes = n * multiplier;
            return campaignStep;
        }

        this.errors.push({
            line: astLine,
            message: astLine.source + ' is not a valid campaign step.'
        });
        return campaignStep;
    },

    _parseEmailTemplateParamAst: function (astLine) {
        var delimiter = astLine.source.indexOf(':');
        var key = astLine.source.substring(0, delimiter);
        var value = astLine.source.substring(delimiter + 1).trim();
        var lastLineNo = astLine.lineNo;

        // if no key then this is a syntax error
        if (!key) {
            this.errors.push({
                line: astLine,
                message:astLine.source + ' is not a valid custom field'
            });
            return {
                key: '',
                value: ''
            };
        }

        // join together any child lines text treating empty lines like paragraph breaks
        value += astLine.children.map(function (child) {

            var ret = child.source;

            if (child.lineNo > lastLineNo + 1) {
                ret = '\n' + ret;
            }

            lastLineNo = child.lineNo;
            return ret;

        }).join(' ');

        // return a custom field object
        return {
            key: key,
            value: value
        };
    },

    _parseWeekdays: function (str) {

        var arr = this._commaSentenceToArray(str);
        var map = {
            'monday': 1,
            'tuesday': 2,
            'wednesday': 3,
            'thursday': 4,
            'friday': 5,
            'saturday': 6,
            'sunday': 7
        };

        return arr.map(function (day) {
            if (!map[day.toLowerCase()]) {
                throw new Error(day + ' is not a valid weekday.');
            }
            return map[day.toLowerCase()];
        });
    },

    _parseTimes: function(str) {
        var arr = this._commaSentenceToArray(str);
        return arr.map(this._parseTime.bind(this));
    },

    _parseTime: function(str) {
        var errorMessage = str + ' is not a valid time.';
        var match = str.match(/^([\d\.]+)(pm|am)$/i);

        if (!match) {
            throw new Error(errorMessage);
        }

        var hoursMinutes = match[1].split('.');
        var amPm = match[2].toLowerCase();

        if (hoursMinutes.length > 2 || (amPm !== 'am' && amPm !== 'pm')) {
            throw new Error(errorMessage);
        }

        var hours = parseInt(hoursMinutes[0], 10);
        var minutes = hoursMinutes.length === 1 ? 0 : parseInt(hoursMinutes[1], 10);

        if (isNaN(hours) || hours < 0 || hours > 12 ||
            isNaN(minutes) || minutes < 0 || minutes > 59) {
            throw new Error(errorMessage);
        }

        if (amPm === 'pm') {
            hours = hours + 12;
        }

        return (hours * 100) + minutes;
    },

    _commaSentenceToArray: function(str) {
        return str.split(/,| and /).map(function (s) {
            return s.trim();
        });
    }

};

Erv.fromString = function (str) {
    var erv = new Erv();
    erv.setProgramString(str);
    return erv;
};
