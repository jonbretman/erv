(function (root, factory) {

    if (typeof define === 'function' && define.amd) {
        define(factory);
    } else {
        root.Erv = factory();
    }

}(this, function () {

    /**
     * Takes a string of weekdays and returns an array of numbers representing those days.
     * Will throw an error if an invalid day is found.
     * @param {string} str
     * @returns {number[]}
     */
    function parseWeekdays(str) {

        var arr = commaSentenceToArray(str);
        var days = {
            'monday': 1,
            'tuesday': 2,
            'wednesday': 3,
            'thursday': 4,
            'friday': 5,
            'saturday': 6,
            'sunday': 7
        };

        return arr.map(function (day) {
            if (!days[day.toLowerCase()]) {
                throw new Error(quote(day) + ' is not a valid day.');
            }
            return days[day.toLowerCase()];
        });
    }

    /**
     * Takes a string of times and returns an array of number representing those times.
     * Will throw an error if an invalid time is found.
     * @param {string} str
     * @returns {number[]}
     */
    function parseTimes(str) {
        var arr = commaSentenceToArray(str);
        return arr.map(parseTime);
    }

    /**
     * Parses a string in the format '9am' or '3.30pm' and return a number representing that time.
     * Some examples:
     *     '9am'    -> 900
     *     '1.30pm' -> 1330
     * @param {string} str
     * @returns {number}
     */
    function parseTime(str) {
        var errorMessage = quote(str) + ' is not a valid time.';
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
    }

    /**
     * Takes comma separated list of words and return an array of strings.
     * Some examples:
     *     'one'                 -> ['one']
     *     'one and two'         -> ['one', 'two']
     *     'one, two, and three' -> ['one', 'two', 'three']
     * @param str
     * @returns {string[]}
     */
    function commaSentenceToArray(str) {
        return str.split(/,| and /i).map(function (s) {
            return s.trim();
        });
    }

    /**
     * Takes a string and returns it wrapped in double quotes.
     * @param {string} str
     * @returns {string}
     */
    function quote(str) {
        return '"' + str + '"';
    }

    /**
     * Returns the last element of the passed array.
     * @param {Array} arr
     * @returns {*}
     */
    function last(arr) {
        return arr[arr.length - 1];
    }

    /**
     * Class that represents an erv program.
     * @param {Object} [campaign] An existing campaign object.
     * @constructor
     */
    function Erv(campaign) {
        this.campaign = campaign || null;
        this.ast = [];
        this.programString = '';
        this.errors = [];
    }

    Erv.prototype = {

        /**
         * Updates this instance with a new program string.
         * @param {string} str An Erv program string
         * @returns {Erv}
         */
        setProgramString: function (str) {

            this.programString = str;
            this.ast = [];

            var lines = str.split('\n');
            var context = [this.ast];
            var lastIndent = 0;

            for (var i = 0; i < lines.length; i++) {

                var line = this._astLineFromString(lines[i], i);

                if (!line.source) {
                    continue;
                }

                if (line.indent < lastIndent) {
                    for (var j = 0; j < lastIndent - line.indent; j++) {
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
                        this.ast.push(line);
                        break;
                    }

                    context.push(parentContext.children);
                }

                last(context).push(line);
                lastIndent = line.indent;
            }

            if (!this.ast.length) {
                this.ast.push(this._astLineFromString('', 0));
            }

            this._setCampaignFromAstLine(this.ast[0]);
            this._setCampaignStepsFromAstLines(this.ast.slice(1));
            return this;
        },

        /**
         * Takes a single line of an erv program and the line
         * number and return an object representing that line.
         * @param {string} str
         * @param {number} lineNo
         * @returns {{lineNo: {number}, source: {string}, children: Array, indent: number}}
         * @private
         */
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

        /**
         * Updates the campaign using an astLine object.
         * Will record any found errors.
         * @param {object} astLine
         * @returns {Erv}
         * @private
         */
        _setCampaignFromAstLine: function (astLine) {

            var campaign = this.campaign = {
                steps: []
            };

            if (!astLine || !astLine.source) {
                this.errors.push({
                    line: astLine,
                    message: 'A campaign must start with a valid trigger eg. "when", "on", or "at".'
                });
                return this;
            }

            var str = astLine.source;

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
                    campaign.weekdays = parseWeekdays(match[1]);
                }
                catch (e) {
                    this.errors.push({
                        line: astLine,
                        message: e.message
                    });
                }
                try {
                    campaign.hours = parseTimes(match[2]);
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
                message: 'A campaign must start with a valid trigger eg. "when", "on", or "at".'
            });
            return this;
        },

        /**
         * Updates the campaign steps using an array of astLine objects.
         * @param {object} astLines
         * @returns {Erv}
         * @private
         */
        _setCampaignStepsFromAstLines: function (astLines) {
            this.campaign.steps = astLines.map(this._stepFromAstLine.bind(this));
            return this;
        },

        /**
         * Takes an astLine object and returns an object representing a campaign step.
         * Will record any found errors.
         * @param {object} astLine
         * @returns {object}
         * @private
         */
        _stepFromAstLine: function (astLine) {
            var campaignStep = {};

            var match = astLine.source.match(/^send the (.*?) email$/i);
            if (match) {
                campaignStep.type = 'email';
                campaignStep.emailTemplate = match[1].toLowerCase().replace(/ /g, '_');
                campaignStep.emailTemplateParams = astLine.children.map(this._parseEmailTemplateParamAst.bind(this));
                return campaignStep;
            }

            match = astLine.source.match(/^if (.*?)$/i);
            if (match) {
                campaignStep.type = 'condition';
                campaignStep.conditionFunction = match[1].toLowerCase().replace(/ /g, '_');
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
                            message: quote(unit) + ' is not a valid wait unit.'
                        });
                        return campaignStep;

                }

                var n = parseInt(match[1], 10);
                if (isNaN(n)) {
                    this.errors.push({
                        line: astLine,
                        message: quote(match[1]) + ' is not a valid wait amount.'
                    });
                    return campaignStep;
                }

                campaignStep.waitMinutes = n * multiplier;
                return campaignStep;
            }

            this.errors.push({
                line: astLine,
                message: quote(astLine.source) + ' is not a valid campaign step.'
            });
            return campaignStep;
        },

        /**
         * Takes an astLine object for a custom field line and returns an object
         * representing an email template parameter.
         * @param {object} astLine
         * @returns {object}
         * @private
         */
        _parseEmailTemplateParamAst: function (astLine) {
            var delimiter = astLine.source.indexOf(':');
            var key = astLine.source.substring(0, delimiter);
            var value = astLine.source.substring(delimiter + 1).trim();
            var lastLineNo = astLine.lineNo;

            // if no delimiter or key then this is a syntax error
            if (delimiter < 1 || !key) {
                this.errors.push({
                    line: astLine,
                    message: quote(astLine.source) + ' is not a valid custom field.'
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
        }

    };

    /**
     * Convenience method for creating a new Erv instance with a program string.
     * @param {string} str
     * @returns {Erv}
     * @static
     */
    Erv.fromString = function (str) {
        var erv = new Erv();
        erv.setProgramString(str);
        return erv;
    };

    return Erv;

}));
