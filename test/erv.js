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
            ['Every Tuesday at 9.30am', [2], [930]],
            ['Every Monday, Wednesday and Friday at 9am, 1pm and 6pm', [1,3,5], [900, 1300, 1800]]
        ];

        variations.forEach(function (spec) {
            expect(Erv.fromString(spec[0]).campaign.weekdays).to.eql(spec[1]);
            expect(Erv.fromString(spec[0]).campaign.hours).to.eql(spec[2]);
            expect(Erv.fromString(spec[0]).campaign.type).to.equal('P');
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

});
