// sigh - PhantomJS doesn't have .bind()
if (!Function.prototype.bind) {
    Function.prototype.bind = function (originalThis) {
        if (typeof this !== "function") {
            throw new TypeError("Function.prototype.bind - what is trying to be bound is not callable");
        }

        var argumentsArray = Array.prototype.slice.call(arguments, 1),
            functionToBind = this,
            nopFunction = function () {
            },
            functionBound = function () {
                return functionToBind.apply(
                        this instanceof nopFunction && originalThis ? this : originalThis,
                    argumentsArray.concat(Array.prototype.slice.call(arguments))
                );
            };

        nopFunction.prototype = this.prototype;
        functionBound.prototype = new nopFunction();
        return functionBound;
    };
}

describe('Erv.fromString', function () {

    it('should return an instance of Erv', function () {
        var erv = Erv.fromString('');
        expect(erv).to.be.a(Erv);
    });

    it('should support event based triggers', function () {
        var variations = [
            ['when a user registers', 'registers'],
            ['When a user makes a purchase', 'makes a purchase']
        ];

        variations.forEach(function (spec) {
            expect(Erv.fromString(spec[0]).campaign.eventType).to.equal(spec[1]);
            expect(Erv.fromString(spec[0]).campaign.type).to.equal('E');
        });
    });

    it('should support recurring triggers', function () {
        var variations = [
            ['every monday at 3pm', [1], [1500]],
            ['Every Tuesday and thursday at 9.30am', [2, 4], [930]],
            ['every Saturday and Sunday at 9.30am', [6, 7], [930]],
            ['Every Monday, Wednesday and Friday at 9am, 1pm and 6pm', [1,3,5], [900, 1300, 1800]]
        ];

        variations.forEach(function (spec) {
            expect(Erv.fromString(spec[0]).campaign.weekdays).to.eql(spec[1]);
            expect(Erv.fromString(spec[0]).campaign.hours).to.eql(spec[2]);
            expect(Erv.fromString(spec[0]).campaign.type).to.equal('P');
        });
    });

    it('should be an error if either the days or times are not valid', function () {
        var erv = Erv.fromString('every kitten at 5pm');
        expect(erv.errors[0].message).to.equal('"kitten" is not a valid day.');

        var invalidTimes = ['teapot', '13pm', '700am', '4', '5.4.20pm', '7.30kitten'];
        invalidTimes.forEach(function (time) {
             erv = Erv.fromString('every tuesday at ' + time);
            expect(erv.errors[0].message).to.equal('"' + time + '" is not a valid time.');
        });
    });

    it('should support one off triggers', function () {
        var variations = [
            ['on 01/12/14 at 3pm', '01/12/14 3pm']
        ];

        variations.forEach(function (spec) {
            expect(Erv.fromString(spec[0]).campaign.localDatetime).to.equal(spec[1]);
            expect(Erv.fromString(spec[0]).campaign.type).to.equal('O');
        });
    });

    it('should be an error to not define a valid campaign trigger', function () {
        var erv = Erv.fromString('send the foobar email');
        expect(erv.errors).to.have.length(1);
        expect(erv.errors[0].message).to.equal('"send the foobar email" is not a valid campaign trigger.');
        expect(erv.errors[0].line.lineNo).to.equal(1);
    });

    it('should be an error to indent the first line', function () {
        var errors = Erv.fromString('    when a user registers').errors;
        expect(errors[0].message).to.equal('Indentation is not allowed here.');
    });

    it('should parse "wait" steps and capture the wait time in minutes', function () {
        var variations = [
            ['wait for 1 minute', 1],
            ['wait for 30 minutes', 30],
            ['Wait for 30 mins', 30],
            ['Wait for 1 hour', 60],
            ['wait for 2 hours', 120],
            ['wait for 1 day', 1440],
            ['wait for 3 days', 4320]
        ];

        variations.forEach(function (spec) {
            var programString = 'when a user does something\n' + spec[0];
            var waitStep = Erv.fromString(programString).campaign.steps[0];
            expect(waitStep.waitMinutes).to.equal(spec[1]);
            expect(waitStep.type).to.equal('wait');
        });
    });

    it('should be an error if the wait unit is not valid', function () {
        var programString = [
            'when a user does something',
            'wait for 5 kittens'
        ].join('\n');

        var erv = Erv.fromString(programString);
        expect(erv.errors[0].message).to.equal('"kittens" is not a valid wait unit.');
    });

    it('should be an error if the wait value is not a number', function () {
        var programString = [
            'when a user does something',
            'wait for kitten minutes'
        ].join('\n');

        var erv = Erv.fromString(programString);
        expect(erv.errors[0].message).to.equal('"kitten" is not a valid wait amount.');
    });

    it('should parse "condition" steps and capture the condition function', function () {
        var programString = 'when a user does something\nif my amazing condition function';
        var conditionStep = Erv.fromString(programString).campaign.steps[0];
        expect(conditionStep.type).to.equal('condition');
        expect(conditionStep.conditionFunction).to.equal('my_amazing_condition_function');
    });

    it('should parse "send" steps and capture the email template name and any custom fields', function () {
        var programString = 'when a user does something\nSend the Welcome to Lyst email';
        var sendStep = Erv.fromString(programString).campaign.steps[0];
        expect(sendStep.type).to.equal('email');
        expect(sendStep.emailTemplate).to.equal('welcome_to_lyst');

        programString = [
            'when a user does something',
            'send the welcome to lyst email',
            '    subject: This is the subject',
            '    section_1_text:',
            '        Some longer text that can span multiple lines',
            '        to make it easier to write.',
            '        ',
            '        It can also contain multiple paragraphs separated',
            '        a single line break.',
            '    section_2_header: Hey {{ recipient.name }}! Here is some awesome stuff'
        ].join('\n');

        sendStep = Erv.fromString(programString).campaign.steps[0];
        expect(sendStep.emailTemplateParams).to.have.length(3);
        expect(sendStep.emailTemplateParams).to.eql([
            {
                key: 'subject',
                value: 'This is the subject'
            },
            {
                key: 'section_1_text',
                value: 'Some longer text that can span multiple lines to make it easier to write. \nIt can also contain multiple paragraphs separated a single line break.'
            },
            {
                key: 'section_2_header',
                value: 'Hey {{ recipient.name }}! Here is some awesome stuff'
            }
        ]);
    });

    it('should record an error if a custom field is not in invalid', function () {
        var programString = [
            'when a user does something',
            'send the welcome to lyst email',
            '    puff the magic dragon'
        ].join('\n');

        var errors = Erv.fromString(programString).errors;
        expect(errors[0].message).to.equal('"puff the magic dragon" is not a valid custom field.');
    });

    it('should record an error if an invalid step is given', function () {
        var programString = [
            'when a user does something',
            'make a nice cup of tea'
        ].join('\n');

        var errors = Erv.fromString(programString).errors;
        expect(errors).to.have.length(1);
        expect(errors[0].message).to.equal('"make a nice cup of tea" is not a valid campaign step.');
        expect(errors[0].line.lineNo).to.equal(2);
    });

});
