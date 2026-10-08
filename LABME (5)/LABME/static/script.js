/* QR generator (c) 2009 Kazuhiko Arase, MIT licence - bundled so QR codes work offline */
(function(){var defs={},cache={};
defs["QRMode"]=function(module,exports,require){
module.exports = {
    MODE_NUMBER :       1 << 0,
    MODE_ALPHA_NUM :    1 << 1,
    MODE_8BIT_BYTE :    1 << 2,
    MODE_KANJI :        1 << 3
};

};
defs["QRErrorCorrectLevel"]=function(module,exports,require){
module.exports = {
	L : 1,
	M : 0,
	Q : 3,
	H : 2
};


};
defs["QRMaskPattern"]=function(module,exports,require){
module.exports = {
	PATTERN000 : 0,
	PATTERN001 : 1,
	PATTERN010 : 2,
	PATTERN011 : 3,
	PATTERN100 : 4,
	PATTERN101 : 5,
	PATTERN110 : 6,
	PATTERN111 : 7
};

};
defs["QRMath"]=function(module,exports,require){
var QRMath = {

	glog : function(n) {
	
		if (n < 1) {
			throw new Error("glog(" + n + ")");
		}
		
		return QRMath.LOG_TABLE[n];
	},
	
	gexp : function(n) {
	
		while (n < 0) {
			n += 255;
		}
	
		while (n >= 256) {
			n -= 255;
		}
	
		return QRMath.EXP_TABLE[n];
	},
	
	EXP_TABLE : new Array(256),
	
	LOG_TABLE : new Array(256)

};
	
for (var i = 0; i < 8; i++) {
	QRMath.EXP_TABLE[i] = 1 << i;
}
for (var i = 8; i < 256; i++) {
	QRMath.EXP_TABLE[i] = QRMath.EXP_TABLE[i - 4]
		^ QRMath.EXP_TABLE[i - 5]
		^ QRMath.EXP_TABLE[i - 6]
		^ QRMath.EXP_TABLE[i - 8];
}
for (var i = 0; i < 255; i++) {
	QRMath.LOG_TABLE[QRMath.EXP_TABLE[i] ] = i;
}

module.exports = QRMath;

};
defs["QRPolynomial"]=function(module,exports,require){
var QRMath = require('./QRMath');

function QRPolynomial(num, shift) {
	if (num.length === undefined) {
		throw new Error(num.length + "/" + shift);
	}

	var offset = 0;

	while (offset < num.length && num[offset] === 0) {
		offset++;
	}

	this.num = new Array(num.length - offset + shift);
	for (var i = 0; i < num.length - offset; i++) {
		this.num[i] = num[i + offset];
	}
}

QRPolynomial.prototype = {

	get : function(index) {
		return this.num[index];
	},
	
	getLength : function() {
		return this.num.length;
	},
	
	multiply : function(e) {
	
		var num = new Array(this.getLength() + e.getLength() - 1);
	
		for (var i = 0; i < this.getLength(); i++) {
			for (var j = 0; j < e.getLength(); j++) {
				num[i + j] ^= QRMath.gexp(QRMath.glog(this.get(i) ) + QRMath.glog(e.get(j) ) );
			}
		}
	
		return new QRPolynomial(num, 0);
	},
	
	mod : function(e) {
	
		if (this.getLength() - e.getLength() < 0) {
			return this;
		}
	
		var ratio = QRMath.glog(this.get(0) ) - QRMath.glog(e.get(0) );
	
		var num = new Array(this.getLength() );
		
		for (var i = 0; i < this.getLength(); i++) {
			num[i] = this.get(i);
		}
		
		for (var x = 0; x < e.getLength(); x++) {
			num[x] ^= QRMath.gexp(QRMath.glog(e.get(x) ) + ratio);
		}
	
		// recursive call
		return new QRPolynomial(num, 0).mod(e);
	}
};

module.exports = QRPolynomial;

};
defs["QRUtil"]=function(module,exports,require){
var QRMode = require('./QRMode');
var QRPolynomial = require('./QRPolynomial');
var QRMath = require('./QRMath');
var QRMaskPattern = require('./QRMaskPattern');

var QRUtil = {

    PATTERN_POSITION_TABLE : [
        [],
        [6, 18],
        [6, 22],
        [6, 26],
        [6, 30],
        [6, 34],
        [6, 22, 38],
        [6, 24, 42],
        [6, 26, 46],
        [6, 28, 50],
        [6, 30, 54],        
        [6, 32, 58],
        [6, 34, 62],
        [6, 26, 46, 66],
        [6, 26, 48, 70],
        [6, 26, 50, 74],
        [6, 30, 54, 78],
        [6, 30, 56, 82],
        [6, 30, 58, 86],
        [6, 34, 62, 90],
        [6, 28, 50, 72, 94],
        [6, 26, 50, 74, 98],
        [6, 30, 54, 78, 102],
        [6, 28, 54, 80, 106],
        [6, 32, 58, 84, 110],
        [6, 30, 58, 86, 114],
        [6, 34, 62, 90, 118],
        [6, 26, 50, 74, 98, 122],
        [6, 30, 54, 78, 102, 126],
        [6, 26, 52, 78, 104, 130],
        [6, 30, 56, 82, 108, 134],
        [6, 34, 60, 86, 112, 138],
        [6, 30, 58, 86, 114, 142],
        [6, 34, 62, 90, 118, 146],
        [6, 30, 54, 78, 102, 126, 150],
        [6, 24, 50, 76, 102, 128, 154],
        [6, 28, 54, 80, 106, 132, 158],
        [6, 32, 58, 84, 110, 136, 162],
        [6, 26, 54, 82, 110, 138, 166],
        [6, 30, 58, 86, 114, 142, 170]
    ],

    G15 : (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0),
    G18 : (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0),
    G15_MASK : (1 << 14) | (1 << 12) | (1 << 10)    | (1 << 4) | (1 << 1),

    getBCHTypeInfo : function(data) {
        var d = data << 10;
        while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15) >= 0) {
            d ^= (QRUtil.G15 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15) ) );    
        }
        return ( (data << 10) | d) ^ QRUtil.G15_MASK;
    },

    getBCHTypeNumber : function(data) {
        var d = data << 12;
        while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18) >= 0) {
            d ^= (QRUtil.G18 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18) ) );    
        }
        return (data << 12) | d;
    },

    getBCHDigit : function(data) {

        var digit = 0;

        while (data !== 0) {
            digit++;
            data >>>= 1;
        }

        return digit;
    },

    getPatternPosition : function(typeNumber) {
        return QRUtil.PATTERN_POSITION_TABLE[typeNumber - 1];
    },

    getMask : function(maskPattern, i, j) {
        
        switch (maskPattern) {
            
        case QRMaskPattern.PATTERN000 : return (i + j) % 2 === 0;
        case QRMaskPattern.PATTERN001 : return i % 2 === 0;
        case QRMaskPattern.PATTERN010 : return j % 3 === 0;
        case QRMaskPattern.PATTERN011 : return (i + j) % 3 === 0;
        case QRMaskPattern.PATTERN100 : return (Math.floor(i / 2) + Math.floor(j / 3) ) % 2 === 0;
        case QRMaskPattern.PATTERN101 : return (i * j) % 2 + (i * j) % 3 === 0;
        case QRMaskPattern.PATTERN110 : return ( (i * j) % 2 + (i * j) % 3) % 2 === 0;
        case QRMaskPattern.PATTERN111 : return ( (i * j) % 3 + (i + j) % 2) % 2 === 0;

        default :
            throw new Error("bad maskPattern:" + maskPattern);
        }
    },

    getErrorCorrectPolynomial : function(errorCorrectLength) {

        var a = new QRPolynomial([1], 0);

        for (var i = 0; i < errorCorrectLength; i++) {
            a = a.multiply(new QRPolynomial([1, QRMath.gexp(i)], 0) );
        }

        return a;
    },

    getLengthInBits : function(mode, type) {

        if (1 <= type && type < 10) {

            // 1 - 9

            switch(mode) {
            case QRMode.MODE_NUMBER     : return 10;
            case QRMode.MODE_ALPHA_NUM  : return 9;
            case QRMode.MODE_8BIT_BYTE  : return 8;
            case QRMode.MODE_KANJI      : return 8;
            default :
                throw new Error("mode:" + mode);
            }

        } else if (type < 27) {

            // 10 - 26

            switch(mode) {
            case QRMode.MODE_NUMBER     : return 12;
            case QRMode.MODE_ALPHA_NUM  : return 11;
            case QRMode.MODE_8BIT_BYTE  : return 16;
            case QRMode.MODE_KANJI      : return 10;
            default :
                throw new Error("mode:" + mode);
            }

        } else if (type < 41) {

            // 27 - 40

            switch(mode) {
            case QRMode.MODE_NUMBER     : return 14;
            case QRMode.MODE_ALPHA_NUM  : return 13;
            case QRMode.MODE_8BIT_BYTE  : return 16;
            case QRMode.MODE_KANJI      : return 12;
            default :
                throw new Error("mode:" + mode);
            }

        } else {
            throw new Error("type:" + type);
        }
    },

    getLostPoint : function(qrCode) {
        
        var moduleCount = qrCode.getModuleCount();
        var lostPoint = 0;
        var row = 0; 
        var col = 0;

        
        // LEVEL1
        
        for (row = 0; row < moduleCount; row++) {

            for (col = 0; col < moduleCount; col++) {

                var sameCount = 0;
                var dark = qrCode.isDark(row, col);

                for (var r = -1; r <= 1; r++) {

                    if (row + r < 0 || moduleCount <= row + r) {
                        continue;
                    }

                    for (var c = -1; c <= 1; c++) {

                        if (col + c < 0 || moduleCount <= col + c) {
                            continue;
                        }

                        if (r === 0 && c === 0) {
                            continue;
                        }

                        if (dark === qrCode.isDark(row + r, col + c) ) {
                            sameCount++;
                        }
                    }
                }

                if (sameCount > 5) {
                    lostPoint += (3 + sameCount - 5);
                }
            }
        }

        // LEVEL2

        for (row = 0; row < moduleCount - 1; row++) {
            for (col = 0; col < moduleCount - 1; col++) {
                var count = 0;
                if (qrCode.isDark(row,     col    ) ) count++;
                if (qrCode.isDark(row + 1, col    ) ) count++;
                if (qrCode.isDark(row,     col + 1) ) count++;
                if (qrCode.isDark(row + 1, col + 1) ) count++;
                if (count === 0 || count === 4) {
                    lostPoint += 3;
                }
            }
        }

        // LEVEL3

        for (row = 0; row < moduleCount; row++) {
            for (col = 0; col < moduleCount - 6; col++) {
                if (qrCode.isDark(row, col) && 
                        !qrCode.isDark(row, col + 1) && 
                         qrCode.isDark(row, col + 2) && 
                         qrCode.isDark(row, col + 3) && 
                         qrCode.isDark(row, col + 4) && 
                        !qrCode.isDark(row, col + 5) && 
                         qrCode.isDark(row, col + 6) ) {
                    lostPoint += 40;
                }
            }
        }

        for (col = 0; col < moduleCount; col++) {
            for (row = 0; row < moduleCount - 6; row++) {
                if (qrCode.isDark(row, col) &&
                        !qrCode.isDark(row + 1, col) &&
                         qrCode.isDark(row + 2, col) &&
                         qrCode.isDark(row + 3, col) &&
                         qrCode.isDark(row + 4, col) &&
                        !qrCode.isDark(row + 5, col) &&
                         qrCode.isDark(row + 6, col) ) {
                    lostPoint += 40;
                }
            }
        }

        // LEVEL4
        
        var darkCount = 0;

        for (col = 0; col < moduleCount; col++) {
            for (row = 0; row < moduleCount; row++) {
                if (qrCode.isDark(row, col) ) {
                    darkCount++;
                }
            }
        }
        
        var ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
        lostPoint += ratio * 10;

        return lostPoint;       
    }

};

module.exports = QRUtil;

};
defs["QRRSBlock"]=function(module,exports,require){
var QRErrorCorrectLevel = require('./QRErrorCorrectLevel');

function QRRSBlock(totalCount, dataCount) {
	this.totalCount = totalCount;
	this.dataCount  = dataCount;
}

QRRSBlock.RS_BLOCK_TABLE = [

	// L
	// M
	// Q
	// H

	// 1
	[1, 26, 19],
	[1, 26, 16],
	[1, 26, 13],
	[1, 26, 9],
	
	// 2
	[1, 44, 34],
	[1, 44, 28],
	[1, 44, 22],
	[1, 44, 16],

	// 3
	[1, 70, 55],
	[1, 70, 44],
	[2, 35, 17],
	[2, 35, 13],

	// 4		
	[1, 100, 80],
	[2, 50, 32],
	[2, 50, 24],
	[4, 25, 9],
	
	// 5
	[1, 134, 108],
	[2, 67, 43],
	[2, 33, 15, 2, 34, 16],
	[2, 33, 11, 2, 34, 12],
	
	// 6
	[2, 86, 68],
	[4, 43, 27],
	[4, 43, 19],
	[4, 43, 15],
	
	// 7		
	[2, 98, 78],
	[4, 49, 31],
	[2, 32, 14, 4, 33, 15],
	[4, 39, 13, 1, 40, 14],
	
	// 8
	[2, 121, 97],
	[2, 60, 38, 2, 61, 39],
	[4, 40, 18, 2, 41, 19],
	[4, 40, 14, 2, 41, 15],
	
	// 9
	[2, 146, 116],
	[3, 58, 36, 2, 59, 37],
	[4, 36, 16, 4, 37, 17],
	[4, 36, 12, 4, 37, 13],
	
	// 10		
	[2, 86, 68, 2, 87, 69],
	[4, 69, 43, 1, 70, 44],
	[6, 43, 19, 2, 44, 20],
	[6, 43, 15, 2, 44, 16],

	// 11
	[4, 101, 81],
	[1, 80, 50, 4, 81, 51],
	[4, 50, 22, 4, 51, 23],
	[3, 36, 12, 8, 37, 13],

	// 12
	[2, 116, 92, 2, 117, 93],
	[6, 58, 36, 2, 59, 37],
	[4, 46, 20, 6, 47, 21],
	[7, 42, 14, 4, 43, 15],

	// 13
	[4, 133, 107],
	[8, 59, 37, 1, 60, 38],
	[8, 44, 20, 4, 45, 21],
	[12, 33, 11, 4, 34, 12],

	// 14
	[3, 145, 115, 1, 146, 116],
	[4, 64, 40, 5, 65, 41],
	[11, 36, 16, 5, 37, 17],
	[11, 36, 12, 5, 37, 13],

	// 15
	[5, 109, 87, 1, 110, 88],
	[5, 65, 41, 5, 66, 42],
	[5, 54, 24, 7, 55, 25],
	[11, 36, 12],

	// 16
	[5, 122, 98, 1, 123, 99],
	[7, 73, 45, 3, 74, 46],
	[15, 43, 19, 2, 44, 20],
	[3, 45, 15, 13, 46, 16],

	// 17
	[1, 135, 107, 5, 136, 108],
	[10, 74, 46, 1, 75, 47],
	[1, 50, 22, 15, 51, 23],
	[2, 42, 14, 17, 43, 15],

	// 18
	[5, 150, 120, 1, 151, 121],
	[9, 69, 43, 4, 70, 44],
	[17, 50, 22, 1, 51, 23],
	[2, 42, 14, 19, 43, 15],

	// 19
	[3, 141, 113, 4, 142, 114],
	[3, 70, 44, 11, 71, 45],
	[17, 47, 21, 4, 48, 22],
	[9, 39, 13, 16, 40, 14],

	// 20
	[3, 135, 107, 5, 136, 108],
	[3, 67, 41, 13, 68, 42],
	[15, 54, 24, 5, 55, 25],
	[15, 43, 15, 10, 44, 16],

	// 21
	[4, 144, 116, 4, 145, 117],
	[17, 68, 42],
	[17, 50, 22, 6, 51, 23],
	[19, 46, 16, 6, 47, 17],

	// 22
	[2, 139, 111, 7, 140, 112],
	[17, 74, 46],
	[7, 54, 24, 16, 55, 25],
	[34, 37, 13],

	// 23
	[4, 151, 121, 5, 152, 122],
	[4, 75, 47, 14, 76, 48],
	[11, 54, 24, 14, 55, 25],
	[16, 45, 15, 14, 46, 16],

	// 24
	[6, 147, 117, 4, 148, 118],
	[6, 73, 45, 14, 74, 46],
	[11, 54, 24, 16, 55, 25],
	[30, 46, 16, 2, 47, 17],

	// 25
	[8, 132, 106, 4, 133, 107],
	[8, 75, 47, 13, 76, 48],
	[7, 54, 24, 22, 55, 25],
	[22, 45, 15, 13, 46, 16],

	// 26
	[10, 142, 114, 2, 143, 115],
	[19, 74, 46, 4, 75, 47],
	[28, 50, 22, 6, 51, 23],
	[33, 46, 16, 4, 47, 17],

	// 27
	[8, 152, 122, 4, 153, 123],
	[22, 73, 45, 3, 74, 46],
	[8, 53, 23, 26, 54, 24],
	[12, 45, 15, 28, 46, 16],

	// 28
	[3, 147, 117, 10, 148, 118],
	[3, 73, 45, 23, 74, 46],
	[4, 54, 24, 31, 55, 25],
	[11, 45, 15, 31, 46, 16],

	// 29
	[7, 146, 116, 7, 147, 117],
	[21, 73, 45, 7, 74, 46],
	[1, 53, 23, 37, 54, 24],
	[19, 45, 15, 26, 46, 16],

	// 30
	[5, 145, 115, 10, 146, 116],
	[19, 75, 47, 10, 76, 48],
	[15, 54, 24, 25, 55, 25],
	[23, 45, 15, 25, 46, 16],

	// 31
	[13, 145, 115, 3, 146, 116],
	[2, 74, 46, 29, 75, 47],
	[42, 54, 24, 1, 55, 25],
	[23, 45, 15, 28, 46, 16],

	// 32
	[17, 145, 115],
	[10, 74, 46, 23, 75, 47],
	[10, 54, 24, 35, 55, 25],
	[19, 45, 15, 35, 46, 16],

	// 33
	[17, 145, 115, 1, 146, 116],
	[14, 74, 46, 21, 75, 47],
	[29, 54, 24, 19, 55, 25],
	[11, 45, 15, 46, 46, 16],

	// 34
	[13, 145, 115, 6, 146, 116],
	[14, 74, 46, 23, 75, 47],
	[44, 54, 24, 7, 55, 25],
	[59, 46, 16, 1, 47, 17],

	// 35
	[12, 151, 121, 7, 152, 122],
	[12, 75, 47, 26, 76, 48],
	[39, 54, 24, 14, 55, 25],
	[22, 45, 15, 41, 46, 16],

	// 36
	[6, 151, 121, 14, 152, 122],
	[6, 75, 47, 34, 76, 48],
	[46, 54, 24, 10, 55, 25],
	[2, 45, 15, 64, 46, 16],

	// 37
	[17, 152, 122, 4, 153, 123],
	[29, 74, 46, 14, 75, 47],
	[49, 54, 24, 10, 55, 25],
	[24, 45, 15, 46, 46, 16],

	// 38
	[4, 152, 122, 18, 153, 123],
	[13, 74, 46, 32, 75, 47],
	[48, 54, 24, 14, 55, 25],
	[42, 45, 15, 32, 46, 16],

	// 39
	[20, 147, 117, 4, 148, 118],
	[40, 75, 47, 7, 76, 48],
	[43, 54, 24, 22, 55, 25],
	[10, 45, 15, 67, 46, 16],

	// 40
	[19, 148, 118, 6, 149, 119],
	[18, 75, 47, 31, 76, 48],
	[34, 54, 24, 34, 55, 25],
	[20, 45, 15, 61, 46, 16]
];

QRRSBlock.getRSBlocks = function(typeNumber, errorCorrectLevel) {
	
	var rsBlock = QRRSBlock.getRsBlockTable(typeNumber, errorCorrectLevel);
	
	if (rsBlock === undefined) {
		throw new Error("bad rs block @ typeNumber:" + typeNumber + "/errorCorrectLevel:" + errorCorrectLevel);
	}

	var length = rsBlock.length / 3;
	
	var list = [];
	
	for (var i = 0; i < length; i++) {

		var count = rsBlock[i * 3 + 0];
		var totalCount = rsBlock[i * 3 + 1];
		var dataCount  = rsBlock[i * 3 + 2];

		for (var j = 0; j < count; j++) {
			list.push(new QRRSBlock(totalCount, dataCount) );	
		}
	}
	
	return list;
};

QRRSBlock.getRsBlockTable = function(typeNumber, errorCorrectLevel) {

	switch(errorCorrectLevel) {
	case QRErrorCorrectLevel.L :
		return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
	case QRErrorCorrectLevel.M :
		return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
	case QRErrorCorrectLevel.Q :
		return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
	case QRErrorCorrectLevel.H :
		return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
	default :
		return undefined;
	}
};

module.exports = QRRSBlock;

};
defs["QRBitBuffer"]=function(module,exports,require){
function QRBitBuffer() {
	this.buffer = [];
	this.length = 0;
}

QRBitBuffer.prototype = {

	get : function(index) {
		var bufIndex = Math.floor(index / 8);
		return ( (this.buffer[bufIndex] >>> (7 - index % 8) ) & 1) == 1;
	},
	
	put : function(num, length) {
		for (var i = 0; i < length; i++) {
			this.putBit( ( (num >>> (length - i - 1) ) & 1) == 1);
		}
	},
	
	getLengthInBits : function() {
		return this.length;
	},
	
	putBit : function(bit) {
	
		var bufIndex = Math.floor(this.length / 8);
		if (this.buffer.length <= bufIndex) {
			this.buffer.push(0);
		}
	
		if (bit) {
			this.buffer[bufIndex] |= (0x80 >>> (this.length % 8) );
		}
	
		this.length++;
	}
};

module.exports = QRBitBuffer;

};
defs["QR8bitByte"]=function(module,exports,require){
var QRMode = require('./QRMode');

function QR8bitByte(data) {
	this.mode = QRMode.MODE_8BIT_BYTE;
	this.data = data;
}

QR8bitByte.prototype = {

	getLength : function() {
		return this.data.length;
	},
	
	write : function(buffer) {
		for (var i = 0; i < this.data.length; i++) {
			// not JIS ...
			buffer.put(this.data.charCodeAt(i), 8);
		}
	}
};

module.exports = QR8bitByte;

};
defs["index"]=function(module,exports,require){
//---------------------------------------------------------------------
// QRCode for JavaScript
//
// Copyright (c) 2009 Kazuhiko Arase
//
// URL: http://www.d-project.com/
//
// Licensed under the MIT license:
//   http://www.opensource.org/licenses/mit-license.php
//
// The word "QR Code" is registered trademark of 
// DENSO WAVE INCORPORATED
//   http://www.denso-wave.com/qrcode/faqpatent-e.html
//
//---------------------------------------------------------------------
// Modified to work in node for this project (and some refactoring)
//---------------------------------------------------------------------

var QR8bitByte = require('./QR8bitByte');
var QRUtil = require('./QRUtil');
var QRPolynomial = require('./QRPolynomial');
var QRRSBlock = require('./QRRSBlock');
var QRBitBuffer = require('./QRBitBuffer');

function QRCode(typeNumber, errorCorrectLevel) {
	this.typeNumber = typeNumber;
	this.errorCorrectLevel = errorCorrectLevel;
	this.modules = null;
	this.moduleCount = 0;
	this.dataCache = null;
	this.dataList = [];
}

QRCode.prototype = {
	
	addData : function(data) {
		var newData = new QR8bitByte(data);
		this.dataList.push(newData);
		this.dataCache = null;
	},
	
	isDark : function(row, col) {
		if (row < 0 || this.moduleCount <= row || col < 0 || this.moduleCount <= col) {
			throw new Error(row + "," + col);
		}
		return this.modules[row][col];
	},

	getModuleCount : function() {
		return this.moduleCount;
	},
	
	make : function() {
		// Calculate automatically typeNumber if provided is < 1
		if (this.typeNumber < 1 ){
			var typeNumber = 1;
			for (typeNumber = 1; typeNumber < 40; typeNumber++) {
				var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, this.errorCorrectLevel);

				var buffer = new QRBitBuffer();
				var totalDataCount = 0;
				for (var i = 0; i < rsBlocks.length; i++) {
					totalDataCount += rsBlocks[i].dataCount;
				}

				for (var x = 0; x < this.dataList.length; x++) {
					var data = this.dataList[x];
					buffer.put(data.mode, 4);
					buffer.put(data.getLength(), QRUtil.getLengthInBits(data.mode, typeNumber) );
					data.write(buffer);
				}
				if (buffer.getLengthInBits() <= totalDataCount * 8)
					break;
			}
			this.typeNumber = typeNumber;
		}
		this.makeImpl(false, this.getBestMaskPattern() );
	},
	
	makeImpl : function(test, maskPattern) {
		
		this.moduleCount = this.typeNumber * 4 + 17;
		this.modules = new Array(this.moduleCount);
		
		for (var row = 0; row < this.moduleCount; row++) {
			
			this.modules[row] = new Array(this.moduleCount);
			
			for (var col = 0; col < this.moduleCount; col++) {
				this.modules[row][col] = null;//(col + row) % 3;
			}
		}
	
		this.setupPositionProbePattern(0, 0);
		this.setupPositionProbePattern(this.moduleCount - 7, 0);
		this.setupPositionProbePattern(0, this.moduleCount - 7);
		this.setupPositionAdjustPattern();
		this.setupTimingPattern();
		this.setupTypeInfo(test, maskPattern);
		
		if (this.typeNumber >= 7) {
			this.setupTypeNumber(test);
		}
	
		if (this.dataCache === null) {
			this.dataCache = QRCode.createData(this.typeNumber, this.errorCorrectLevel, this.dataList);
		}
	
		this.mapData(this.dataCache, maskPattern);
	},

	setupPositionProbePattern : function(row, col)  {
		
		for (var r = -1; r <= 7; r++) {
			
			if (row + r <= -1 || this.moduleCount <= row + r) continue;
			
			for (var c = -1; c <= 7; c++) {
				
				if (col + c <= -1 || this.moduleCount <= col + c) continue;
				
				if ( (0 <= r && r <= 6 && (c === 0 || c === 6) ) || 
                     (0 <= c && c <= 6 && (r === 0 || r === 6) ) || 
                     (2 <= r && r <= 4 && 2 <= c && c <= 4) ) {
					this.modules[row + r][col + c] = true;
				} else {
					this.modules[row + r][col + c] = false;
				}
			}		
		}		
	},
	
	getBestMaskPattern : function() {
	
		var minLostPoint = 0;
		var pattern = 0;
	
		for (var i = 0; i < 8; i++) {
			
			this.makeImpl(true, i);
	
			var lostPoint = QRUtil.getLostPoint(this);
	
			if (i === 0 || minLostPoint >  lostPoint) {
				minLostPoint = lostPoint;
				pattern = i;
			}
		}
	
		return pattern;
	},
	
	createMovieClip : function(target_mc, instance_name, depth) {
	
		var qr_mc = target_mc.createEmptyMovieClip(instance_name, depth);
		var cs = 1;
	
		this.make();

		for (var row = 0; row < this.modules.length; row++) {
			
			var y = row * cs;
			
			for (var col = 0; col < this.modules[row].length; col++) {
	
				var x = col * cs;
				var dark = this.modules[row][col];
			
				if (dark) {
					qr_mc.beginFill(0, 100);
					qr_mc.moveTo(x, y);
					qr_mc.lineTo(x + cs, y);
					qr_mc.lineTo(x + cs, y + cs);
					qr_mc.lineTo(x, y + cs);
					qr_mc.endFill();
				}
			}
		}
		
		return qr_mc;
	},

	setupTimingPattern : function() {
		
		for (var r = 8; r < this.moduleCount - 8; r++) {
			if (this.modules[r][6] !== null) {
				continue;
			}
			this.modules[r][6] = (r % 2 === 0);
		}
	
		for (var c = 8; c < this.moduleCount - 8; c++) {
			if (this.modules[6][c] !== null) {
				continue;
			}
			this.modules[6][c] = (c % 2 === 0);
		}
	},
	
	setupPositionAdjustPattern : function() {
	
		var pos = QRUtil.getPatternPosition(this.typeNumber);
		
		for (var i = 0; i < pos.length; i++) {
		
			for (var j = 0; j < pos.length; j++) {
			
				var row = pos[i];
				var col = pos[j];
				
				if (this.modules[row][col] !== null) {
					continue;
				}
				
				for (var r = -2; r <= 2; r++) {
				
					for (var c = -2; c <= 2; c++) {
					
						if (Math.abs(r) === 2 || 
                            Math.abs(c) === 2 ||
                            (r === 0 && c === 0) ) {
							this.modules[row + r][col + c] = true;
						} else {
							this.modules[row + r][col + c] = false;
						}
					}
				}
			}
		}
	},
	
	setupTypeNumber : function(test) {
	
		var bits = QRUtil.getBCHTypeNumber(this.typeNumber);
        var mod;
	
		for (var i = 0; i < 18; i++) {
			mod = (!test && ( (bits >> i) & 1) === 1);
			this.modules[Math.floor(i / 3)][i % 3 + this.moduleCount - 8 - 3] = mod;
		}
	
		for (var x = 0; x < 18; x++) {
			mod = (!test && ( (bits >> x) & 1) === 1);
			this.modules[x % 3 + this.moduleCount - 8 - 3][Math.floor(x / 3)] = mod;
		}
	},
	
	setupTypeInfo : function(test, maskPattern) {
	
		var data = (this.errorCorrectLevel << 3) | maskPattern;
		var bits = QRUtil.getBCHTypeInfo(data);
        var mod;
	
		// vertical		
		for (var v = 0; v < 15; v++) {
	
			mod = (!test && ( (bits >> v) & 1) === 1);
	
			if (v < 6) {
				this.modules[v][8] = mod;
			} else if (v < 8) {
				this.modules[v + 1][8] = mod;
			} else {
				this.modules[this.moduleCount - 15 + v][8] = mod;
			}
		}
	
		// horizontal
		for (var h = 0; h < 15; h++) {
	
			mod = (!test && ( (bits >> h) & 1) === 1);
			
			if (h < 8) {
				this.modules[8][this.moduleCount - h - 1] = mod;
			} else if (h < 9) {
				this.modules[8][15 - h - 1 + 1] = mod;
			} else {
				this.modules[8][15 - h - 1] = mod;
			}
		}
	
		// fixed module
		this.modules[this.moduleCount - 8][8] = (!test);
	
	},
	
	mapData : function(data, maskPattern) {
		
		var inc = -1;
		var row = this.moduleCount - 1;
		var bitIndex = 7;
		var byteIndex = 0;
		
		for (var col = this.moduleCount - 1; col > 0; col -= 2) {
	
			if (col === 6) col--;
	
			while (true) {
	
				for (var c = 0; c < 2; c++) {
					
					if (this.modules[row][col - c] === null) {
						
						var dark = false;
	
						if (byteIndex < data.length) {
							dark = ( ( (data[byteIndex] >>> bitIndex) & 1) === 1);
						}
	
						var mask = QRUtil.getMask(maskPattern, row, col - c);
	
						if (mask) {
							dark = !dark;
						}
						
						this.modules[row][col - c] = dark;
						bitIndex--;
	
						if (bitIndex === -1) {
							byteIndex++;
							bitIndex = 7;
						}
					}
				}
								
				row += inc;
	
				if (row < 0 || this.moduleCount <= row) {
					row -= inc;
					inc = -inc;
					break;
				}
			}
		}
		
	}

};

QRCode.PAD0 = 0xEC;
QRCode.PAD1 = 0x11;

QRCode.createData = function(typeNumber, errorCorrectLevel, dataList) {
	
	var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectLevel);
	
	var buffer = new QRBitBuffer();
	
	for (var i = 0; i < dataList.length; i++) {
		var data = dataList[i];
		buffer.put(data.mode, 4);
		buffer.put(data.getLength(), QRUtil.getLengthInBits(data.mode, typeNumber) );
		data.write(buffer);
	}

	// calc num max data.
	var totalDataCount = 0;
	for (var x = 0; x < rsBlocks.length; x++) {
		totalDataCount += rsBlocks[x].dataCount;
	}

	if (buffer.getLengthInBits() > totalDataCount * 8) {
		throw new Error("code length overflow. (" + 
            buffer.getLengthInBits() + 
            ">" +  
            totalDataCount * 8 + 
            ")");
	}

	// end code
	if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
		buffer.put(0, 4);
	}

	// padding
	while (buffer.getLengthInBits() % 8 !== 0) {
		buffer.putBit(false);
	}

	// padding
	while (true) {
		
		if (buffer.getLengthInBits() >= totalDataCount * 8) {
			break;
		}
		buffer.put(QRCode.PAD0, 8);
		
		if (buffer.getLengthInBits() >= totalDataCount * 8) {
			break;
		}
		buffer.put(QRCode.PAD1, 8);
	}

	return QRCode.createBytes(buffer, rsBlocks);
};

QRCode.createBytes = function(buffer, rsBlocks) {

	var offset = 0;
	
	var maxDcCount = 0;
	var maxEcCount = 0;
	
	var dcdata = new Array(rsBlocks.length);
	var ecdata = new Array(rsBlocks.length);
	
	for (var r = 0; r < rsBlocks.length; r++) {

		var dcCount = rsBlocks[r].dataCount;
		var ecCount = rsBlocks[r].totalCount - dcCount;

		maxDcCount = Math.max(maxDcCount, dcCount);
		maxEcCount = Math.max(maxEcCount, ecCount);
		
		dcdata[r] = new Array(dcCount);
		
		for (var i = 0; i < dcdata[r].length; i++) {
			dcdata[r][i] = 0xff & buffer.buffer[i + offset];
		}
		offset += dcCount;
		
		var rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
		var rawPoly = new QRPolynomial(dcdata[r], rsPoly.getLength() - 1);

		var modPoly = rawPoly.mod(rsPoly);
		ecdata[r] = new Array(rsPoly.getLength() - 1);
		for (var x = 0; x < ecdata[r].length; x++) {
            var modIndex = x + modPoly.getLength() - ecdata[r].length;
			ecdata[r][x] = (modIndex >= 0)? modPoly.get(modIndex) : 0;
		}

	}
	
	var totalCodeCount = 0;
	for (var y = 0; y < rsBlocks.length; y++) {
		totalCodeCount += rsBlocks[y].totalCount;
	}

	var data = new Array(totalCodeCount);
	var index = 0;

	for (var z = 0; z < maxDcCount; z++) {
		for (var s = 0; s < rsBlocks.length; s++) {
			if (z < dcdata[s].length) {
				data[index++] = dcdata[s][z];
			}
		}
	}

	for (var xx = 0; xx < maxEcCount; xx++) {
		for (var t = 0; t < rsBlocks.length; t++) {
			if (xx < ecdata[t].length) {
				data[index++] = ecdata[t][xx];
			}
		}
	}

	return data;

};

module.exports = QRCode;

};
function req(n){n=n.replace("./","");if(cache[n])return cache[n].exports;var m={exports:{}};cache[n]=m;defs[n](m,m.exports,req);return m.exports;}
var QRCode=req("index"),ECL=req("QRErrorCorrectLevel");
function build(text){for(var t=1;t<=40;t++){try{var q=new QRCode(t,ECL.M);q.addData(text);q.make();return q;}catch(e){}}throw new Error("QR too long");}
window.QRGen={image:function(text,size){var q=build(text),n=q.getModuleCount(),cell=Math.max(2,Math.floor(size*2/(n+8))),dim=(n+8)*cell,c=document.createElement("canvas");c.width=c.height=dim;var x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,dim,dim);x.fillStyle="#000";
for(var r=0;r<n;r++)for(var k=0;k<n;k++)if(q.isDark(r,k))x.fillRect((k+4)*cell,(r+4)*cell,cell,cell);
var im=new Image();im.src=c.toDataURL("image/png");im.width=size;im.height=size;im.alt="QR code";im.style.imageRendering="pixelated";return im;}};
})();

(function(){
"use strict";
var COMP_CATS=["Desktop","Laptop","Monitor","Keyboard","Mouse","Printer","Projector","UPS","Headset","Webcam","Others"];
var HE_CATS=["Sewing Machine","Stove","Oven","Refrigerator","Blender","Mixer","Iron","Electric Fan","Cooking Utensil","Kitchen Equipment","Table","Chair","Projector","Others"];
var BRANDS=["HP","Dell","Acer","Lenovo","ASUS","MSI","Apple","Samsung","Canon","Epson","Brother","Logitech","A4Tech","ViewSonic","BenQ","LG","Philips","Kingston","WD","Seagate","Other"];
var KEY="labme_db_v1";
var S=null, cur={user:null, lab:"Computer Laboratory", view:"dash"};

function nowStr(){var d=new Date();return d.toLocaleString();}
function today(){var d=new Date();return d.toISOString().slice(0,10);}
function load(){try{var r=localStorage.getItem(KEY);if(r)return JSON.parse(r);}catch(e){}return null;}
function newId(){return Date.now()*1000+Math.floor(Math.random()*1000);}
var SH=["users","equip","tx","att","logs"],sync={db:null,last:{},busy:false,timer:null,ro:false},syncDone=false;
function persistLocal(){try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){}}
function save(){persistLocal();queueSync();}
function shardStr(k){var a=S[k]||[],cap={tx:600,att:600,logs:150}[k],str;if(cap)a=a.slice(0,cap);str=JSON.stringify(a);while(cap&&str.length>240000&&a.length>10){a=a.slice(0,Math.floor(a.length*0.8));str=JSON.stringify(a);}return str;}
function setSync(st){
  var m={synced:["Synced across devices","ok"],syncing:["Syncing\u2026",""],local:["Local only \u00b7 not shared","local"],ro:["View only \u00b7 changes not shared","local"]}[st];
  sync.state=st;var p=$("syncpill"),c=$("syncchip");if(p){p.textContent=m[0];p.className="pill "+m[1];}if(c)c.textContent=m[0];
}
function queueSync(){if(!sync.db||sync.ro)return;clearTimeout(sync.timer);sync.timer=setTimeout(flush,200);}
function flush(){
  sync.timer=null;if(!sync.db||sync.ro)return;
  if(sync.busy){sync.timer=setTimeout(flush,250);return;}
  var jobs=[];SH.forEach(function(k){var x=shardStr(k);if(x!==sync.last[k])jobs.push([k,x]);});
  if(!jobs.length){setSync("synced");return;}
  sync.busy=true;setSync("syncing");
  jobs.reduce(function(p,j){return p.then(function(){return sync.db.doc("labme/"+j[0]).set({v:j[1]}).then(function(){sync.last[j[0]]=j[1];});});},Promise.resolve()).then(function(){
    sync.busy=false;setSync("synced");if(SH.some(function(k){return shardStr(k)!==sync.last[k];}))queueSync();
  }).catch(function(e){
    sync.busy=false;
    if(e&&(e.code==="invalid_argument"||e.code==="not_granted"||e.code==="revoked")){sync.ro=true;setSync("ro");}
    else{setSync("local");sync.timer=setTimeout(flush,4000);}
  });
}
function afterRemote(){
  persistLocal();
  if(cur.user){var u=null;S.users.forEach(function(x){if(x.id===cur.user.id)u=x;});if(!u||u.status!=="approved"){$("logout").click();return;}cur.user=u;}
  if(!$("app").classList.contains("hidden"))render();
}
function subscribeShard(k){
  sync.db.doc("labme/"+k).onSnapshot(function(sn){
    if(!sn.exists)return;var d=sn.data(),str=d&&d.v;if(typeof str!=="string"||str===sync.last[k])return;
    if(str===shardStr(k)){sync.last[k]=str;return;}
    if(!sync.ro&&(sync.busy||sync.timer))return;
    try{S[k]=JSON.parse(str);sync.last[k]=str;afterRemote();}catch(e){}
  },function(){setSync("local");});
}
var API=(function(){
  var L={},es=null,opened=false;
  function url(k){return "/api/doc/labme/"+k;}
  function fetchDoc(k){return fetch(url(k),{cache:"no-store"}).then(function(r){if(!r.ok)throw{code:"unavailable"};return r.json();});}
  function deliver(k,data){(L[k]||[]).forEach(function(f){f({exists:true,data:function(){return data;}});});}
  function connect(){
    es=new EventSource("/api/events");
    es.addEventListener("doc",function(e){var m=JSON.parse(e.data);deliver(m.k,m.data);});
    es.onopen=function(){if(opened){Object.keys(L).forEach(function(k){fetchDoc(k).then(function(j){if(j.exists)deliver(k,j.data);}).catch(function(){});});}opened=true;};
  }
  return{doc:function(p){var k=p.split("/")[1];return{
    get:function(){return fetchDoc(k).then(function(j){return{exists:!!j.exists,data:function(){return j.data;}};});},
    set:function(o){return fetch(url(k),{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(o)}).then(function(r){if(!r.ok)throw{code:r.status===400?"invalid_argument":"unavailable"};});},
    onSnapshot:function(cb){if(!es)connect();(L[k]=L[k]||[]).push(cb);}
  };}};
})();
function initSync(){
  setSync("syncing");
  fetch("/api/info",{cache:"no-store"}).then(function(r){if(!r.ok)throw 0;return r.json();}).then(function(i){window.LABME_BASE=i.url;return API;}).catch(function(){return null;}).then(function(db){
    if(!db){syncDone=true;setSync("local");return;}
    sync.db=db;
    return Promise.all(SH.map(function(k){return db.doc("labme/"+k).get().then(function(sn){var d=sn.exists&&sn.data();if(d&&typeof d.v==="string"){try{S[k]=JSON.parse(d.v);sync.last[k]=d.v;}catch(e){}}});})).then(function(){
      persistLocal();syncDone=true;setSync("synced");queueSync();SH.forEach(subscribeShard);
    });
  }).catch(function(){sync.db=null;syncDone=true;setSync("local");});
}
function seed(){
  S={uid:2,eid:9,tid:3,aid:1,lid:2,
  users:[{id:1,identifier:"ADMIN001",name:"System Administrator",role:"admin",lab:"Both",status:"approved"}],
  equip:[
    {id:1,lab:"Computer Laboratory",code:"PC 1",cat:"Desktop",brand:"Dell",model:"OptiPlex 3080",serial:"SN-1001",cond:"Good",status:"Available",loc:"Room 201",rem:""},
    {id:2,lab:"Computer Laboratory",code:"PC 2",cat:"Desktop",brand:"HP",model:"ProDesk 400",serial:"SN-1002",cond:"Good",status:"Available",loc:"Room 201",rem:""},
    {id:3,lab:"Computer Laboratory",code:"LAP 1",cat:"Laptop",brand:"Lenovo",model:"ThinkPad E14",serial:"SN-2001",cond:"Fair",status:"Available",loc:"Storage Cabinet",rem:"Minor scratch"},
    {id:4,lab:"Computer Laboratory",code:"PROJ 1",cat:"Projector",brand:"Epson",model:"EB-X05",serial:"SN-4001",cond:"Damaged",status:"Damaged",loc:"Room 201",rem:"Bulb needs replacement"},
    {id:5,lab:"HE Laboratory",code:"SM 1",cat:"Sewing Machine",brand:"Other",model:"Singer 4423",serial:"SN-5001",cond:"Good",status:"Available",loc:"HE Room 1",rem:""},
    {id:6,lab:"HE Laboratory",code:"STOVE 1",cat:"Stove",brand:"Other",model:"Gas Range 2-Burner",serial:"SN-5002",cond:"Good",status:"Available",loc:"HE Room 1",rem:""}
  ],
  tx:[], att:[],
  logs:[{id:1,ts:nowStr(),action:"seed",details:"LABME initialized",user:"system"}]};
  save();
}
S=load(); if(!S) seed();

function log(a,d,u){S.logs.unshift({id:newId(),ts:nowStr(),action:a,details:d,user:u||"-"});}
function toast(m,t){var el=document.getElementById("toast");el.textContent=m;el.className="toast"+(t?" "+t:"");el.style.display="block";clearTimeout(toast._t);toast._t=setTimeout(function(){el.style.display="none";},2800);}
function $(id){return document.getElementById(id);}
function qsa(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));}
function esc(s){return s===undefined||s===null?"":String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
function empty(c,m){return "<tr class='er'><td colspan='"+c+"'><div class='empty'><svg viewBox='0 0 24 24' width='30' height='30' fill='none' stroke='currentColor' stroke-width='1.6' stroke-linejoin='round'><path d='M3 13l3-8h12l3 8v6H3zM3 13h5l1 3h6l1-3h5'/></svg>"+m+"</div></td></tr>";}
function catName(e){return e.cat==="Others"&&e.other?e.other:e.cat;}
function isAdmin(){return !!cur.user&&cur.user.role==="admin";}
function isStu(){return !!cur.user&&cur.user.role==="student";}
function hex(b){return Array.prototype.map.call(new Uint8Array(b),function(x){return ("0"+x.toString(16)).slice(-2);}).join("");}
/* Pure-JS PBKDF2-HMAC-SHA256 (same output as Web Crypto) so sign-in works over plain http:// on the school Wi-Fi */
var SK=new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
var SIV=new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]),SW=new Uint32Array(64);
function sComp(s,w,o){var i,t1,t2,x,y,a=s[0],b=s[1],c=s[2],d=s[3],e=s[4],f=s[5],g=s[6],h=s[7];
  for(i=0;i<16;i++)SW[i]=w[i];
  for(i=16;i<64;i++){x=SW[i-15];y=SW[i-2];SW[i]=(((y>>>17|y<<15)^(y>>>19|y<<13)^(y>>>10))+SW[i-7]+((x>>>7|x<<25)^(x>>>18|x<<14)^(x>>>3))+SW[i-16])|0;}
  for(i=0;i<64;i++){t1=(h+((e>>>6|e<<26)^(e>>>11|e<<21)^(e>>>25|e<<7))+((e&f)^(~e&g))+SK[i]+SW[i])|0;t2=(((a>>>2|a<<30)^(a>>>13|a<<19)^(a>>>22|a<<10))+((a&b)^(a&c)^(b&c)))|0;h=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0;}
  o[0]=(s[0]+a)|0;o[1]=(s[1]+b)|0;o[2]=(s[2]+c)|0;o[3]=(s[3]+d)|0;o[4]=(s[4]+e)|0;o[5]=(s[5]+f)|0;o[6]=(s[6]+g)|0;o[7]=(s[7]+h)|0;}
function sCont(st,msg,prefix){var n=msg.length,tot=((n+9+63)>>6)<<6,buf=new Uint8Array(tot),bits=(prefix+n)*8,s=new Uint32Array(st),o=new Uint32Array(8),w=new Uint32Array(16),i,j;
  buf.set(msg);buf[n]=0x80;buf[tot-4]=(bits>>>24)&255;buf[tot-3]=(bits>>>16)&255;buf[tot-2]=(bits>>>8)&255;buf[tot-1]=bits&255;
  for(i=0;i<tot;i+=64){for(j=0;j<16;j++)w[j]=(buf[i+j*4]<<24|buf[i+j*4+1]<<16|buf[i+j*4+2]<<8|buf[i+j*4+3])>>>0;sComp(s,w,o);s.set(o);}
  return s;}
function pbkdf2js(pw,salt,iters){
  var key=new Uint8Array(64),ip=new Uint32Array(16),op=new Uint32Array(16),i,o,IS=new Uint32Array(8),OS=new Uint32Array(8);
  if(pw.length>64){var hd=sCont(SIV,pw,0);pw=new Uint8Array(32);for(i=0;i<8;i++){pw[i*4]=hd[i]>>>24;pw[i*4+1]=(hd[i]>>>16)&255;pw[i*4+2]=(hd[i]>>>8)&255;pw[i*4+3]=hd[i]&255;}}
  key.set(pw);
  for(i=0;i<16;i++){o=i*4;ip[i]=((key[o]^0x36)<<24|(key[o+1]^0x36)<<16|(key[o+2]^0x36)<<8|(key[o+3]^0x36))>>>0;op[i]=((key[o]^0x5c)<<24|(key[o+1]^0x5c)<<16|(key[o+2]^0x5c)<<8|(key[o+3]^0x5c))>>>0;}
  sComp(SIV,ip,IS);sComp(SIV,op,OS);
  var m=new Uint8Array(salt.length+4);m.set(salt);m[m.length-1]=1;
  var blk=new Uint32Array(16),U=new Uint32Array(8),T=new Uint32Array(8),tmp=new Uint32Array(8);
  blk[8]=0x80000000;blk[15]=768;
  var d1=sCont(IS,m,64);blk.set(d1);sComp(OS,blk,U);T.set(U);
  for(i=1;i<iters;i++){blk.set(U);sComp(IS,blk,tmp);blk.set(tmp);sComp(OS,blk,U);for(o=0;o<8;o++)T[o]^=U[o];}
  var out=new Uint8Array(32);for(i=0;i<8;i++){out[i*4]=T[i]>>>24;out[i*4+1]=(T[i]>>>16)&255;out[i*4+2]=(T[i]>>>8)&255;out[i*4+3]=T[i]&255;}
  return out.buffer;}
function pwHash(pw,sh){var salt=sh?new Uint8Array(sh.match(/../g).map(function(h){return parseInt(h,16);})):crypto.getRandomValues(new Uint8Array(16));if(!(window.crypto&&crypto.subtle))return new Promise(function(res){setTimeout(function(){res({s:hex(salt),h:hex(pbkdf2js(new TextEncoder().encode(pw),salt,150000))});},40);});return crypto.subtle.importKey("raw",new TextEncoder().encode(pw),"PBKDF2",false,["deriveBits"]).then(function(k){return crypto.subtle.deriveBits({name:"PBKDF2",salt:salt,iterations:150000,hash:"SHA-256"},k,256);}).then(function(b){return {s:hex(salt),h:hex(b)};});}
function sameHash(a,b){if(a.length!==b.length)return false;var d=0;for(var i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0;}
var idleT;function bump(){clearTimeout(idleT);if(false)idleT=setTimeout(function(){if(cur.user){$("logout").click();$("ali").textContent="You were signed out after 15 minutes of inactivity.";$("ali").className="alert err";}},900000);}
["click","keydown","pointerdown","touchstart"].forEach(function(ev){document.addEventListener(ev,bump,{passive:true});});
function lockBorrower(){var na=!isAdmin();["borid","borname"].forEach(function(i){var e=$(i);e.readOnly=na;e.classList.toggle("lock",na);});if(na){$("borid").value=cur.user.identifier;$("borname").value=cur.user.name;}}
function clearLogin(){["liid","lipw","rgid","rgname","rgpw","rgpw2"].forEach(function(i){var e=$(i);e.value="";e.setAttribute("readonly","");});}
function noRemember(){["liid","lipw","rgid","rgname","rgpw","rgpw2"].forEach(function(i){var e=$(i);e.name="x"+Math.random().toString(36).slice(2);e.setAttribute("readonly","");e.addEventListener("focus",function(){e.removeAttribute("readonly");});e.addEventListener("pointerdown",function(){e.removeAttribute("readonly");});});qsa("input").forEach(function(e){e.setAttribute("autocomplete","off");});}
function setTheme(){document.documentElement.setAttribute("data-lab",(cur.user&&cur.lab==="HE Laboratory")?"yellow":"");}
function ask(t,x,ok,cb){$("cftitle").textContent=t;$("cftext").textContent=x;$("cfok").textContent=ok;$("cfok").onclick=function(){closeM();cb();};openM("m-conf");}
function badge(s){return '<span class="bdg b-'+String(s||"").toLowerCase().replace(/\s+/g,"-")+'">'+esc(s)+'</span>';}

function choiceRow(id,cb){qsa("#"+id+" button").forEach(function(b){b.addEventListener("click",function(){qsa("#"+id+" button").forEach(function(x){x.classList.remove("on");});b.classList.add("on");cb(b.getAttribute("data-v"));});});}
var liRole="",rgRole="";
choiceRow("lirole",function(v){liRole=v;$("lilbl").textContent=v==="student"?"LRN":"Employee Number";});
choiceRow("rgrole",function(v){rgRole=v;$("rglbl").textContent=v==="student"?"LRN":"Employee Number";});

qsa(".tab").forEach(function(t){t.addEventListener("click",function(){qsa(".tab").forEach(function(x){x.classList.remove("on");});t.classList.add("on");qsa(".pnl").forEach(function(p){p.classList.remove("on");});$("f"+t.getAttribute("data-t")).classList.add("on");});});

$("fli").addEventListener("submit",function(e){
  e.preventDefault();
  var role=liRole,id=$("liid").value.trim(),pw=$("lipw").value,al=$("ali");al.className="alert";$("lipw").value="";
  function bad(m){al.textContent=m;al.className="alert err";}
  if(!role)return bad("Select a role.");
  if(!id||!pw)return bad("Enter your ID and password.");
  if(!syncDone)return bad("Connecting to shared data… please try again in a moment.");
  
  S.fails=S.fails||{};var f=S.fails[id]||{n:0,until:0};
  if(Date.now()<f.until)return bad("Too many attempts. Try again in "+Math.ceil((f.until-Date.now())/1000)+" seconds.");
  function fail(){f.n++;if(f.n>=5){f.until=Date.now()+60000;f.n=0;}S.fails[id]=f;save();bad("Incorrect ID, role or password.");}
  var u=null;S.users.forEach(function(x){if(x.identifier===id)u=x;});
  if(!u||u.role!==role){fail();return;}
  var chk=u.pw?pwHash(pw,u.pw.s).then(function(r){return sameHash(r.h,u.pw.h);}):Promise.resolve(null);
  chk.then(function(ok){
    if(ok===false){fail();return;}
    function go(){
      if(u.status==="pending")return bad("Account pending admin approval.");
      if(u.status==="rejected")return bad("Account request was rejected.");
      delete S.fails[id];cur.user=u;log("login",id+" logged in",id);save();clearLogin();enterApp();
    }
    if(ok===null){
      if(pw.length<8)return bad("This account has no password yet. Enter a new password (8+ characters) to set it.");
      return pwHash(pw).then(function(r){u.pw=r;save();go();});
    }
    go();
  }).catch(function(){bad("Sign-in failed. Please try again.");});
});

$("frg").addEventListener("submit",function(e){
  e.preventDefault();
  var role=rgRole,id=$("rgid").value.trim(),nm=$("rgname").value.trim(),pw=$("rgpw").value,pw2=$("rgpw2").value,al=$("arg");al.className="alert";
  function bad(m){al.textContent=m;al.className="alert err";}
  if(!role)return bad("Select student or employee.");
  if(!id||!nm||!pw)return bad("Fill all fields.");
  if(pw.length<8)return bad("Password must be at least 8 characters.");
  if(pw!==pw2)return bad("Passwords do not match.");
  if(S.users.some(function(u){return u.identifier===id;}))return bad("An account with that ID already exists.");
  if(!syncDone)return bad("Connecting to shared data… please try again in a moment.");
  
  pwHash(pw).then(function(r){
    S.users.push({id:newId(),identifier:id,name:nm,role:role,lab:"Both",status:"pending",pw:r});
    log("register","New request: "+id+" ("+nm+")",id);save();
    al.textContent="Submitted! Wait for admin approval.";al.className="alert ok";
    $("frg").reset();clearLogin();qsa("#rgrole button").forEach(function(b){b.classList.remove("on");});rgRole="";
  }).catch(function(){bad("Sign-up failed. Please try again.");});
});

function enterApp(){
  $("login").classList.add("hidden"); $("app").classList.remove("hidden");
  $("unm").textContent=cur.user.name; $("url").textContent=cur.user.role;
  $("uav").textContent=(cur.user.name||"?").charAt(0).toUpperCase();
  var admin=cur.user.role==="admin";$("app").setAttribute("data-role",cur.user.role);$("rolepill").textContent=admin?"Administrator":"Standard access";
  qsa(".admin").forEach(function(b){b.style.display=admin?"":"none";});
  qsa(".nostu").forEach(function(b){b.style.display=isStu()?"none":"";});bump();
  var opts=admin||cur.user.lab==="Both"?["Computer Laboratory","HE Laboratory","Both"]:[cur.user.lab];
  var sel=$("labsw"); sel.innerHTML="";
  opts.forEach(function(o){var op=document.createElement("option");op.value=o;op.textContent=o;sel.appendChild(op);});
  cur.lab=opts[0]; sel.value=cur.lab; $("slab").textContent=cur.lab; setTheme();
  sel.onchange=function(){cur.lab=sel.value;$("slab").textContent=cur.lab;setTheme();render();};
  document.querySelector('.nav button[data-v="dash"]').click();
}

qsa(".nav button[data-v]").forEach(function(b){b.addEventListener("click",function(){
  var vv=b.getAttribute("data-v");if(!cur.user||(isStu()&&vv!=="dash"&&vv!=="att")||(!isAdmin()&&(vv==="users"||vv==="logs")))return;
  cur.view=vv;
  qsa(".nav button").forEach(function(x){x.classList.remove("on");}); b.classList.add("on");
  qsa(".view").forEach(function(v){v.classList.remove("on");});
  $("v-"+cur.view).classList.add("on");
  var titles={dash:["Dashboard","Overview of laboratory status"],equip:["Equipment","Manage inventory"],borrow:["Borrowing","Borrow / return items"],att:["Attendance","Time in / out"],users:["Users","Approve accounts"],logs:["System Logs","Recent actions"],settings:["Settings","Account and storage info"]};
  $("vt").textContent=titles[cur.view][0]; $("vs").textContent=titles[cur.view][1];
  render();
}); });

$("logout").addEventListener("click",function(){cur.user=null;setTheme();clearLogin();$("app").classList.add("hidden");$("login").classList.remove("hidden");});

function inLab(lab){return cur.lab==="Both"||lab===cur.lab;}

function render(){
  if((isStu()&&cur.view!=="dash"&&cur.view!=="att")||(!isAdmin()&&(cur.view==="users"||cur.view==="logs")))cur.view="dash";
  if(cur.view==="dash")renderDash();
  else if(cur.view==="equip")renderEquip();
  else if(cur.view==="borrow")renderTx();
  else if(cur.view==="att")renderAtt();
  else if(cur.view==="users")renderUsers();
  else if(cur.view==="logs")renderLogs();
  else if(cur.view==="settings")renderSettings();
}
function renderSettings(){
  $("setid").textContent=cur.user.identifier;$("setname").textContent=cur.user.name;
  $("setrole").textContent=cur.user.role;$("setlab").textContent=cur.user.lab;
}

function renderDash(){
  var dv=$("v-dash");dv.classList.add("ld");clearTimeout(renderDash._t);renderDash._t=setTimeout(function(){dv.classList.remove("ld");},350);
  var admin=isAdmin(),me=cur.user.identifier;
  var eq=S.equip.filter(function(e){return inLab(e.lab);});
  var n=eq.length,a=eq.filter(function(e){return e.status==="Available";}).length,b=eq.filter(function(e){return e.status==="Borrowed";}).length,d=eq.filter(function(e){return e.status==="Damaged";}).length;
  $("s1").textContent=n;$("s2").textContent=a;$("s3").textContent=b;$("s4").textContent=d;
  $("s5").textContent=S.users.filter(function(u){return u.role==="student"&&u.status==="approved"&&(cur.lab==="Both"||u.lab===cur.lab||u.lab==="Both");}).length;
  var td=S.att.filter(function(x){return x.date===today()&&inLab(x.lab)&&(admin||x.ident===me);});
  $("s6").textContent=td.length;
  $("avpct").textContent=(n?Math.round(a/n*100):0)+"%";
  $("bara").style.width=(n?a/n*100:0)+"%";$("barb").style.width=(n?b/n*100:0)+"%";$("barc").style.width=(n?d/n*100:0)+"%";
  $("lga").textContent=a;$("lgb").textContent=b;$("lgc").textContent=d;
  var mine=S.tx.filter(function(t){return t.bid===me&&inLab(t.lab);}),act=mine.filter(function(t){return t.status==="Borrowed";});
  $("m1").textContent=act.length;$("m2").textContent=mine.length-act.length;$("m3").textContent=td.length;
  var h="";act.forEach(function(t){h+="<tr><td>"+esc(t.code)+"</td><td>"+esc(t.out)+"</td><td>"+esc(t.purpose)+"</td><td class='acts'><button class='btn p' onclick='LM.retMine("+t.id+")'>Return</button></td></tr>";});
  $("mybody").innerHTML=h||empty(4,"You have no borrowed items.");
  h="";S.logs.filter(function(l){return admin||l.user===me;}).slice(0,6).forEach(function(l){h+='<div class="row"><span class="act">'+esc(String(l.action).replace(/_/g," "))+'</span><span class="det">'+esc(l.details)+'</span><time>'+esc(l.ts)+'</time></div>';});
  $("recent").innerHTML=h||'<div class="empty">No activity yet.</div>';
  h="";td.slice(0,5).forEach(function(x){h+='<div class="row"><span class="act" style="text-transform:none">'+esc(x.name)+'</span><span class="det">In '+esc(x.tin)+(x.tout?' · Out '+esc(x.tout):'')+'</span></div>';});
  $("attnow").innerHTML=h||'<div class="empty">No time-ins yet today.</div>';
}

function renderEquip(){
  var q=$("eqsearch").value.trim().toLowerCase(), st=$("eqstatus").value;
  var items=S.equip.filter(function(e){
    if(!inLab(e.lab))return false;
    if(q&&(e.code+" "+catName(e)).toLowerCase().indexOf(q)===-1)return false;
    if(st&&e.status!==st)return false;
    return true;
  });
  var canEdit=cur.user.role==="admin";
  var h="";
  items.forEach(function(e){
    h+="<tr><td>"+esc(e.code)+"</td><td>"+esc(catName(e))+"</td><td>"+esc(e.brand)+"</td><td>"+esc(e.cond)+"</td><td>"+badge(e.status)+"</td><td class='acts'>";
    h+="<button class='btn o' onclick='LM.viewEq("+e.id+")'>View</button>";
    if(canEdit)h+="<button class='btn o' onclick='LM.editEq("+e.id+")'>Edit</button>";
    if(cur.user.role==="admin")h+="<button class='btn d' onclick='LM.delEq("+e.id+")'>Delete</button>";
    h+="</td></tr>";
  });
  $("eqbody").innerHTML=h||empty(6,"No equipment found.");
}

function renderTx(){
  var items=S.tx.filter(function(t){return inLab(t.lab)&&(isAdmin()||t.bid===cur.user.identifier);});
  var h="";
  items.forEach(function(t){h+="<tr><td>"+esc(t.code)+"</td><td>"+esc(t.bname)+"</td><td>"+esc(t.purpose)+"</td><td>"+esc(t.out)+"</td><td>"+badge(t.status)+"</td></tr>";});
  $("txbody").innerHTML=h||empty(5,"No transactions yet.");
}

function renderAtt(){
  var items=S.att.filter(function(a){return inLab(a.lab)&&(isAdmin()||a.ident===cur.user.identifier);});
  var h="";
  items.forEach(function(a){h+="<tr><td>"+esc(a.ident)+"</td><td>"+esc(a.name)+"</td><td>"+esc(a.role)+"</td><td>"+esc(a.tin)+"</td><td>"+esc(a.tout||"-")+"</td></tr>";});
  $("attbody").innerHTML=h||empty(5,"No records yet.");
}

function renderUsers(){
  var h="";
  S.users.forEach(function(u){
    h+="<tr><td>"+esc(u.identifier)+"</td><td>"+esc(u.name)+"</td><td>"+esc(u.role)+"</td><td>"+esc(u.lab)+"</td><td>"+badge(u.status)+"</td><td class='acts'>";
    if(u.status==="pending"){h+="<button class='btn p' onclick='LM.appr("+u.id+")'>Approve</button><button class='btn d' onclick='LM.rej("+u.id+")'>Reject</button>";}
    if(u.role!=="admin"&&u.pw)h+="<button class='btn o' onclick='LM.rpw("+u.id+")'>Reset password</button>";
    h+="</td></tr>";
  });
  $("usbody").innerHTML=h;
}

function renderLogs(){
  var h="";
  S.logs.forEach(function(l){h+="<tr><td>"+esc(l.ts)+"</td><td>"+esc(l.action)+"</td><td>"+esc(l.details)+"</td><td>"+esc(l.user)+"</td></tr>";});
  $("logbody").innerHTML=h;
}

// ---- modal helpers ----
var _o=function(){};function openM(id){clearTimeout(closeM._t);$("mbg").classList.remove("out");qsa(".modal").forEach(function(m){m.classList.remove("on");});$("mbg").classList.add("on");$(id).classList.add("on");}
function closeM(){var bg=$("mbg");stopScanner();if(!bg.classList.contains("on"))return;bg.classList.add("out");clearTimeout(closeM._t);closeM._t=setTimeout(function(){bg.classList.remove("on","out");qsa(".modal").forEach(function(m){m.classList.remove("on");});},170);}
document.addEventListener("keydown",function(e){if(e.key==="Escape"){if($("m-scan").classList.contains("on"))leaveScanner();else closeM();}});
qsa(".cx").forEach(function(b){b.addEventListener("click",closeM);});
$("mbg").addEventListener("click",function(e){if(e.target.id==="mbg")closeM();});

function fillCat(lab,sel){
  var list=lab==="HE Laboratory"?HE_CATS:COMP_CATS;
  $("eqcat").innerHTML=list.map(function(c){return "<option"+(c===sel?" selected":"")+">"+c+"</option>";}).join("");toggleOther();
}
function toggleOther(){var o=$("eqcat").value==="Others";$("eqotherwrap").classList.toggle("hidden",!o);$("eqother").required=o;}
$("eqcat").addEventListener("change",toggleOther);
function fillBrand(sel){
  $("eqbrand").innerHTML='<option value="">Select Brand</option>'+BRANDS.map(function(b){return "<option"+(b===sel?" selected":"")+">"+b+"</option>";}).join("");
}
$("eqlab").addEventListener("change",function(){fillCat($("eqlab").value);});

$("btnaddeq").addEventListener("click",function(){
  $("feq").reset();$("eqid").value="";$("eqtitle").textContent="Add Equipment";
  var lab=cur.lab==="HE Laboratory"?"HE Laboratory":"Computer Laboratory";
  $("eqlab").value=lab; fillCat(lab); $("eqother").value=""; fillBrand();
  $("eqcode").disabled=false; $("eqlab").disabled=false; $("scaneq").disabled=false;
  openM("m-eq");
});
$("feq").addEventListener("submit",function(e){
  e.preventDefault();if(!isAdmin())return;
  var id=$("eqid").value, lab=$("eqlab").value, code=$("eqcode").value.trim();
  if(!code){toast("Asset code required","err");return;}
  if($("eqcat").value==="Others"&&!$("eqother").value.trim()){toast("Enter the equipment name","err");$("eqother").focus();return;}
  var data={lab:lab,code:code,cat:$("eqcat").value,other:$("eqcat").value==="Others"?$("eqother").value.trim():"",brand:$("eqbrand").value,model:$("eqmodel").value.trim(),
    serial:$("eqserial").value.trim(),cond:$("eqcond").value,status:$("eqstat").value,
    loc:$("eqloc").value.trim(),rem:$("eqrem").value.trim()};
  if(id){
    var it=null; S.equip.forEach(function(x){if(String(x.id)===id)it=x;});
    Object.assign(it,data);
    log("equipment_update","Updated "+code,cur.user.identifier);
  } else {
    var dup=false; S.equip.forEach(function(x){if(x.lab===lab&&x.code===code)dup=true;});
    if(dup){toast("Asset code already exists in this lab","err");return;}
    data.id=newId(); S.equip.push(data);
    log("equipment_add","Added "+lab+"/"+code,cur.user.identifier);
  }
  save(); closeM(); renderEquip(); toast("Equipment saved","ok");
});

// ---- view + QR ----
var viewingId=null;
function openView(id){
  var it=null; S.equip.forEach(function(x){if(x.id===id)it=x;});
  if(!it)return; viewingId=id;
  var h="<p><strong>Laboratory:</strong> "+esc(it.lab)+"</p><p><strong>Asset/Control Number:</strong> "+esc(it.code)+"</p><p><strong>Category:</strong> "+esc(it.cat==="Others"&&it.other?"Others \u2014 "+it.other:it.cat)+"</p><p><strong>Brand:</strong> "+esc(it.brand)+"</p><p><strong>Model:</strong> "+esc(it.model)+"</p><p><strong>Serial:</strong> "+esc(it.serial)+"</p><p><strong>Condition:</strong> "+esc(it.cond)+"</p><p><strong>Status:</strong> "+badge(it.status)+"</p><p><strong>Department:</strong> "+esc(it.loc)+"</p><p><strong>Remarks:</strong> "+esc(it.rem)+"</p>";
  $("viewbody").innerHTML=h; openM("m-view");
}
function findEqByCode(code){
  var it=null;
  S.equip.forEach(function(x){if(x.code.toLowerCase()===code.toLowerCase()&&inLab(x.lab))it=x;});
  return it;
}
function genQr(idOverride){
  var lookId=idOverride!==undefined?idOverride:viewingId;
  var it=null; S.equip.forEach(function(x){if(x.id===lookId)it=x;});
  if(!it){toast("Equipment not found","err");return;}
  viewingId=it.id;
  var text=((/^(localhost|127\.|\[::1\])/.test(location.hostname)&&window.LABME_BASE)||location.origin)+"/#qr="+encodeURIComponent("LABME|"+it.lab+"|"+it.code);
  $("qrbox").innerHTML="";
  try{$("qrbox").appendChild(QRGen.image(text,180));}
  catch(e){$("qrbox").innerHTML="<p style='color:#999;font-size:.8rem'>Could not draw the QR code.</p>";}
  $("qrtext").textContent=it.lab+" \u2014 "+it.code;
  openM("m-qr");
}
$("btnviewqr").addEventListener("click",function(){genQr();});
$("btnprintqr").addEventListener("click",function(){genQr();setTimeout(printQr,300);});
$("btnprintqr2").addEventListener("click",printQr);

// ---- camera scan (html5-qrcode) + photo fallback ----
var scanTarget=null,html5Qr=null,scanRunning=false,scanTok=0;
function inIframe(){try{return window.self!==window.top;}catch(e){return true;}}
function setScan(m,err){$("scanstatus").textContent=m;$("scanstatus").className=err?"err":"";}
var scanOrigin=null;
function leaveScanner(){stopScanner();if(scanOrigin)openM(scanOrigin);else closeM();}
function openScanner(t){scanTarget=t;var cm=qsa(".modal").filter(function(m){return m.classList.contains("on");})[0];scanOrigin=cm?cm.id:null;$("scanOpenTab").classList.toggle("hidden",!inIframe());openM("m-scan");startScanner();}
var scanStop=Promise.resolve(),gotCode=false;
function onDecode(txt){if(gotCode)return;gotCode=true;handleScanResult(txt);}
function killQr(q){var st=0;try{st=q.getState();}catch(e){}return Promise.resolve(st===2||st===3?q.stop():null).catch(function(){}).then(function(){try{q.clear();}catch(e){}});}
function stopScanner(){
  scanTok++;document.removeEventListener("keydown",onScanEsc);
  var q=html5Qr;html5Qr=null;scanRunning=false;
  if(q)scanStop=scanStop.then(function(){return killQr(q);});
  return scanStop;
}
function onScanEsc(){}
function mkQr(){return new Html5Qrcode("reader",{verbose:false,useBarCodeDetectorIfSupported:true,formatsToSupport:[Html5QrcodeSupportedFormats.QR_CODE,Html5QrcodeSupportedFormats.CODE_128,Html5QrcodeSupportedFormats.CODE_39,Html5QrcodeSupportedFormats.EAN_13,Html5QrcodeSupportedFormats.EAN_8,Html5QrcodeSupportedFormats.UPC_A]});}
function startScanner(){
  var prev=stopScanner(),tok=scanTok;gotCode=false;
  document.addEventListener("keydown",onScanEsc);
  setScan("Requesting camera access\u2026");
  if(typeof Html5Qrcode==="undefined"){setScan("Live scanner didn\u2019t load. Use \u201cScan from photo\u201d or type the control number.",1);return;}
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){setScan("This browser blocks camera access here (needs HTTPS). Use \u201cScan from photo\u201d instead.",1);return;}
  prev.then(function(){
    if(tok!==scanTok)return;
    var q=mkQr();html5Qr=q;
    var cfg={fps:10,qrbox:function(w,h){var s=Math.floor(Math.min(w,h)*0.72);return{width:s,height:s};}};
    return q.start({facingMode:"environment"},cfg,onDecode,function(){}).catch(function(e){
      if(tok!==scanTok)throw e;
      return Html5Qrcode.getCameras().then(function(c){if(!c||!c.length)throw e;return q.start(c[c.length-1].id,cfg,onDecode,function(){});});
    }).then(function(){
      if(tok!==scanTok){return killQr(q);}
      scanRunning=true;setScan("Point the camera at the QR code on the equipment");
    });
  }).catch(function(err){
    if(tok!==scanTok)return;
    scanRunning=false;
    var m=String(err&&err.message?err.message:err);
    var f="Couldn\u2019t start the camera: "+m+". Use \u201cScan from photo\u201d instead.";
    if(/NotAllowed|Permission|dismissed|denied/i.test(m))f=inIframe()?"Camera is blocked in this embedded view. Tap \u201cOpen in new tab\u201d and allow camera access, or use \u201cScan from photo\u201d.":"Camera permission denied. Allow camera in your browser\u2019s site settings, then tap Restart camera \u2014 or use \u201cScan from photo\u201d.";
    else if(/NotFound|no camera|Requested device/i.test(m))f="No camera found on this device. Use \u201cScan from photo\u201d or type the control number.";
    else if(/NotReadable|in use/i.test(m))f="Camera is in use by another app. Close it and tap Restart camera.";
    setScan(f,1);
  });
}
function loadImg(file){return new Promise(function(res,rej){var u=URL.createObjectURL(file),i=new Image();i.onload=function(){res({img:i,url:u});};i.onerror=function(){URL.revokeObjectURL(u);rej(new Error("load"));};i.src=u;});}
function scanCanvas(c){
  var p=Promise.resolve(null);
  if(window.BarcodeDetector){p=new Promise(function(res){try{new BarcodeDetector().detect(c).then(function(r){res(r&&r[0]?r[0].rawValue:null);},function(){res(null);});}catch(e){res(null);}});}
  return p.then(function(v){
    if(v)return v;
    if(window.jsQR){var x=c.getContext("2d").getImageData(0,0,c.width,c.height),r=jsQR(x.data,c.width,c.height,{inversionAttempts:"attemptBoth"});if(r&&r.data)return r.data;}
    return null;
  });
}
function decodePhoto(file){
  return loadImg(file).then(function(o){
    var img=o.img,w=img.naturalWidth,h=img.naturalHeight,m=Math.max(w,h),seen={},chain=Promise.resolve(null);
    [1400,900,2000,600,3000].forEach(function(mx){
      chain=chain.then(function(r){
        if(r)return r;
        var k=Math.min(1,mx/m),key=Math.round(k*1000);if(seen[key])return null;seen[key]=1;
        var c=document.createElement("canvas");c.width=Math.max(1,Math.round(w*k));c.height=Math.max(1,Math.round(h*k));
        var cx=c.getContext("2d",{willReadFrequently:true});cx.fillStyle="#fff";cx.fillRect(0,0,c.width,c.height);cx.drawImage(img,0,0,c.width,c.height);
        return scanCanvas(c);
      });
    });
    return chain.then(function(r){
      URL.revokeObjectURL(o.url);
      if(r||typeof Html5Qrcode==="undefined")return r;
      var q=mkQr();
      return q.scanFile(file,false).then(function(t){try{q.clear();}catch(e){}return t;},function(){try{q.clear();}catch(e){}return null;});
    });
  });
}
function scanPhoto(file){
  if(!file)return;
  setScan("Reading photo\u2026");
  stopScanner().then(function(){return decodePhoto(file);}).then(function(t){
    if(t)handleScanResult(t);else setScan("No QR code found in that photo. Fill the frame with the QR code, keep it sharp and well lit, then try again.",1);
  }).catch(function(){setScan("Couldn\u2019t read that image. Try a JPG or PNG photo.",1);});
}
function handleScanResult(text){
  var um=String(text).trim().match(/^https?:\/\/[^#]*#qr=(.+)$/i);if(um){try{text=decodeURIComponent(um[1]);}catch(e){}}
  var target=scanTarget,origin=scanOrigin;stopScanner();
  var p=String(text).split("|"),code=(p[0]==="LABME"&&p.length>=3)?p[2]:String(text).trim(),lab=p.length>=3?p[1]:null,it=null;
  S.equip.forEach(function(x){if(x.code.toLowerCase()===code.toLowerCase()&&(!lab||x.lab===lab||!it))it=x;});
  if(origin)openM(origin);else closeM();
  if(target){$(target).value=it?it.code:code;$(target).dispatchEvent(new Event("input",{bubbles:true}));}
  if(target==="borcode")autoBorrower();
  if(target==="retcode")setTimeout(function(){var b=$("fret").querySelector("button[type=submit]");if(b)b.focus();},150);
  toast(it?"Identified "+it.code+" \u2014 form filled":"Code not in equipment list \u2014 filled as scanned",it?"ok":"err");
}
function autoBorrower(){
  if(cur.user&&cur.user.role!=="admin"){if(!$("borid").value)$("borid").value=cur.user.identifier;if(!$("borname").value)$("borname").value=cur.user.name;}
  setTimeout(function(){var f=["borid","borname","borp"].filter(function(i){return !$(i).value;})[0]||"borp";$(f).focus();},150);
}
$("borid").addEventListener("input",function(){var v=this.value.trim(),u=null;S.users.forEach(function(x){if(x.identifier===v&&x.status==="approved")u=x;});if(u&&isAdmin())$("borname").value=u.name;});
$("scanPhoto").addEventListener("click",function(){$("scanFile").value="";$("scanFile").click();});
$("scanFile").addEventListener("change",function(){scanPhoto(this.files&&this.files[0]);});
function showInfo(inp,box,mode){
  var v=$(inp).value.trim(),el=$(box);
  if(!v){el.className="eqinfo";el.innerHTML="";return;}
  var it=findEqByCode(v);
  if(!it){el.className="eqinfo on err";el.textContent="No equipment with this control number in the selected lab.";return;}
  var tx=null;S.tx.forEach(function(t){if(t.code===it.code&&t.status==="Borrowed"&&inLab(t.lab))tx=t;});
  var bad=mode==="bor"?it.status!=="Available":it.status!=="Borrowed";
  if(mode==="ret"&&tx&&!isAdmin()&&tx.bid!==cur.user.identifier)bad=true;
  el.className="eqinfo on "+(bad?"warn":"ok");
  el.innerHTML="<div><strong>"+esc(catName(it))+"</strong> \u00b7 "+esc((it.brand||"")+" "+(it.model||""))+"<br><small>"+esc(it.lab)+(mode==="ret"&&tx?" \u00b7 "+(isAdmin()?"Borrowed by "+esc(tx.bname)+" ("+esc(tx.bid)+")":(tx.bid===cur.user.identifier?"Borrowed by you":"Borrowed by another user \u2014 you can\u2019t return it")):"")+"</small></div>"+badge(it.status);
}
$("borcode").addEventListener("input",function(){showInfo("borcode","borinfo","bor");});
$("retcode").addEventListener("input",function(){showInfo("retcode","retinfo","ret");});
$("scanbor").addEventListener("click",function(){openScanner("borcode");});
$("scanret").addEventListener("click",function(){openScanner("retcode");});
$("scaneq").addEventListener("click",function(){openScanner("eqcode");});
$("scanClose").addEventListener("click",leaveScanner);
$("scanRetry").addEventListener("click",startScanner);
$("scanOpenTab").addEventListener("click",function(){ window.open(window.location.href,"_blank"); });
function printQr(){
  var box=$("qrbox"); if(!box.innerHTML){toast("Generate the QR first","err");return;}
  var w=window.open("","_blank","width=400,height=400");
  w.document.write(
    "<html><head><title>Print QR</title><style>"+
    "@page{size:50mm 30mm;margin:0}"+
    "html,body{margin:0;padding:0;width:50mm;height:30mm}"+
    "body{display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif}"+
    ".wrap{display:flex;align-items:center;justify-content:center;gap:2mm;width:50mm;height:30mm;box-sizing:border-box;padding:1.5mm}"+
    ".wrap img,.wrap canvas{width:22mm;height:22mm}"+
    ".lbl{font-size:6.5px;line-height:1.25;max-width:22mm;word-break:break-word}"+
    "</style></head><body><div class='wrap'>"+box.innerHTML+"<div class='lbl'>"+esc($("qrtext").textContent)+"</div></div></body></html>"
  );
  w.document.close();
  setTimeout(function(){w.focus();w.print();},250);
}

$("btnborrow").addEventListener("click",function(){$("fbor").reset();lockBorrower();showInfo("borcode","borinfo","bor");openM("m-bor");});
$("fbor").addEventListener("submit",function(e){
  e.preventDefault();
  var code=$("borcode").value.trim(),bid=$("borid").value.trim(),bn=$("borname").value.trim(),p=$("borp").value.trim();
  if(!isAdmin()){bid=cur.user.identifier;bn=cur.user.name;}
  if(!code||!bid||!bn||!p){toast("Fill all fields","err");return;}
  var f0=findEqByCode(code);if(f0)code=f0.code;
  var eq=null; S.equip.forEach(function(x){if(x.code===code&&inLab(x.lab))eq=x;});
  if(!eq){toast("Equipment not found","err");return;}
  if(eq.status==="Borrowed"){toast("Already borrowed","err");return;}
  if(eq.status==="Damaged"){toast("Item is damaged","err");return;}
  S.tx.unshift({id:newId(),lab:eq.lab,code:code,bid:bid,bname:bn,purpose:p,out:nowStr(),status:"Borrowed"});
  eq.status="Borrowed";
  log("borrow",bn+" borrowed "+code,cur.user.identifier);
  save(); closeM(); render(); toast("Item borrowed","ok");
});

$("btnreturn").addEventListener("click",function(){$("fret").reset();showInfo("retcode","retinfo","ret");openM("m-ret");});
$("fret").addEventListener("submit",function(e){
  e.preventDefault();
  var code=$("retcode").value.trim(),ci=$("retcond").value;var f1=findEqByCode(code);if(f1)code=f1.code;
  var tx=null; S.tx.forEach(function(t){if(t.code===code&&t.status==="Borrowed"&&inLab(t.lab))tx=t;});
  if(!tx){toast("No active borrow record","err");return;}
  if(!isAdmin()&&tx.bid!==cur.user.identifier){toast("You can only return items you borrowed","err");return;}
  tx.status="Returned";
  var eq=null; S.equip.forEach(function(x){if(x.code===code&&x.lab===tx.lab)eq=x;});
  if(eq){eq.status=ci==="Damaged"?"Damaged":"Available";eq.cond=ci;}
  log("return","Returned "+code,cur.user.identifier);
  save(); closeM(); render(); toast("Item returned","ok");
});

$("btntin").addEventListener("click",function(){
  var dup=S.att.some(function(a){return a.ident===cur.user.identifier&&a.date===today()&&!a.tout&&a.lab===cur.lab;});
  if(dup){toast("Already timed in today","err");return;}
  S.att.unshift({id:newId(),lab:cur.lab,ident:cur.user.identifier,name:cur.user.name,role:cur.user.role,date:today(),tin:nowStr(),tout:null});
  log("attendance_in",cur.user.identifier+" timed in",cur.user.identifier);
  save(); renderAtt(); toast("Timed in","ok");
});
$("btntout").addEventListener("click",function(){
  var rec=null; S.att.forEach(function(a){if(a.ident===cur.user.identifier&&a.date===today()&&!a.tout&&a.lab===cur.lab)rec=a;});
  if(!rec){toast("No active time-in found","err");return;}
  rec.tout=nowStr();
  log("attendance_out",cur.user.identifier+" timed out",cur.user.identifier);
  save(); renderAtt(); toast("Timed out","ok");
});

qsa("[data-go]").forEach(function(b){b.addEventListener("click",function(){document.querySelector('.nav button[data-v="'+b.getAttribute("data-go")+'"]').click();var d=b.getAttribute("data-do");if(d)$(d).click();});});
$("logout2").addEventListener("click",function(){$("logout").click();});
qsa("table").forEach(function(t){var hs=qsa("th",t).map(function(h){return h.textContent;});new MutationObserver(function(){qsa("tbody tr",t).forEach(function(r){qsa("td",r).forEach(function(c,i){if(hs[i])c.setAttribute("data-label",hs[i]);});});}).observe(t.tBodies[0],{childList:true});});
initSync();noRemember();window.addEventListener("pageshow",function(){if(!cur.user)clearLogin();});
$("btnreset").addEventListener("click",function(){LM.reset();});
$("eqsearch").addEventListener("input",renderEquip);
$("eqstatus").addEventListener("change",renderEquip);

window.LM={retMine:function(id){var t=null;S.tx.forEach(function(x){if(x.id===id)t=x;});if(!t||t.bid!==cur.user.identifier||t.status!=="Borrowed")return;$("fret").reset();$("retcode").value=t.code;showInfo("retcode","retinfo","ret");openM("m-ret");},
  rpw:function(id){if(!isAdmin())return;if(!LM._ok){ask("Reset this user\u2019s password?","They will set a new password the next time they log in.","Reset",function(){LM._ok=1;LM.rpw(id);LM._ok=0;});return;}var u=null;S.users.forEach(function(x){if(x.id===id)u=x;});if(!u||u.role==="admin")return;delete u.pw;log("password_reset","Password reset for "+u.identifier,cur.user.identifier);save();renderUsers();toast("Password reset","ok");},
  scan:function(t){handleScanResult(t);},
  viewEq:function(id){openView(id);},
  editEq:function(id){if(!isAdmin())return;
    var it=null; S.equip.forEach(function(x){if(x.id===id)it=x;});
    if(!it)return;
    $("eqid").value=it.id;$("eqlab").value=it.lab;$("eqcode").value=it.code;
    fillCat(it.lab,it.cat);$("eqother").value=it.other||"";toggleOther();fillBrand(it.brand);
    $("eqmodel").value=it.model||"";$("eqserial").value=it.serial||"";$("eqcond").value=it.cond;$("eqstat").value=it.status;
    $("eqloc").value=it.loc||"";$("eqrem").value=it.rem||"";
    $("eqcode").disabled=true; $("eqlab").disabled=true; $("scaneq").disabled=true;
    $("eqtitle").textContent="Edit Equipment"; openM("m-eq");
  },
  delEq:function(id){if(!isAdmin())return;
    if(!LM._ok){ask("Delete this equipment?","It will be removed from the inventory. This can\u2019t be undone.","Delete",function(){LM._ok=1;LM.delEq(id);LM._ok=0;});return;}
    S.equip=S.equip.filter(function(x){return x.id!==id;});
    log("equipment_delete","Deleted equipment id "+id,cur.user.identifier);
    save(); renderEquip(); toast("Deleted","ok");
  },
  reset:function(){if(!isAdmin())return;if(!LM._ok){ask("Reset all data?","Everything returns to the sample demo set. This can\u2019t be undone.","Reset data",function(){LM._ok=1;LM.reset();LM._ok=0;});return;}seed();cur.user=null;setTheme();clearLogin();$("app").classList.add("hidden");$("login").classList.remove("hidden");toast("Data reset","ok");},
  appr:function(id){if(!isAdmin())return;var u=null;S.users.forEach(function(x){if(x.id===id)u=x;});u.status="approved";log("user_approve","Approved "+u.identifier,cur.user.identifier);save();renderUsers();toast("Approved","ok");},
  rej:function(id){if(!isAdmin())return;if(!LM._ok){ask("Reject this request?","The account request will be marked as rejected.","Reject",function(){LM._ok=1;LM.rej(id);LM._ok=0;});return;}var u=null;S.users.forEach(function(x){if(x.id===id)u=x;});u.status="rejected";log("user_reject","Rejected "+u.identifier,cur.user.identifier);save();renderUsers();toast("Rejected","ok");}
};
})();
