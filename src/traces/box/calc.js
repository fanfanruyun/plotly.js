/**
* Copyright 2012-2017, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/

'use strict';

var isNumeric = require('fast-isnumeric');

var Lib = require('../../lib');
var Axes = require('../../plots/cartesian/axes');

// outlier definition based on http://www.physics.csbsju.edu/stats/box2.html
module.exports = function calc(gd, trace) {
    var xa = Axes.getFromId(gd, trace.xaxis || 'x');
    var ya = Axes.getFromId(gd, trace.yaxis || 'y');
    var orientation = trace.orientation;
    var cd = [];

    var i;
    var valAxis, valLetter;
    var posAxis, posLetter;

    if(orientation === 'h') {
        valAxis = xa;
        valLetter = 'x';
        posAxis = ya;
        posLetter = 'y';
    } else {
        valAxis = ya;
        valLetter = 'y';
        posAxis = xa;
        posLetter = 'x';
    }

    var val = valAxis.makeCalcdata(trace, valLetter);
    var pos = getPos(trace, posLetter, posAxis, val, gd.numboxes);

    var dv = Lib.distinctVals(pos);
    var posDistinct = dv.vals;
    var dPos = dv.minDiff / 2;
    var posBins = makeBins(posDistinct, dPos);

    var vLen = val.length;
    var pLen = posDistinct.length;
    var ptsPerBin = initNestedArray(pLen);

    // bin pts info per position bins
    for(i = 0; i < vLen; i++) {
        var v = val[i];
        if(!isNumeric(v)) continue;

        var n = Lib.findBin(pos[i], posBins);
        if(n >= 0 && n < pLen) {
            var pt = {v: v, i: i};
            arraysToCalcdata(pt, trace, i);
            ptsPerBin[n].push(pt);
        }
    }

    // build calcdata trace items, one item per distinct position
    for(i = 0; i < pLen; i++) {
        if(ptsPerBin[i].length > 0) {
            var pts = ptsPerBin[i].sort(sortByVal);
            var boxVals = pts.map(extractVal);
            var bvLen = boxVals.length;

            var cdi = {
                pos: posDistinct[i],
                pts: pts
            };

            cdi.min = boxVals[0];
            cdi.max = boxVals[bvLen - 1];
            cdi.mean = Lib.mean(boxVals, bvLen);
            cdi.sd = Lib.stdev(boxVals, bvLen, cdi.mean);

            // first quartile
            cdi.q1 = Lib.interp(boxVals, 0.25);
             // median
            cdi.med = Lib.interp(boxVals, 0.5);
            // third quartile
            cdi.q3 = Lib.interp(boxVals, 0.75);

            // lower and upper fences - last point inside
            // 1.5 interquartile ranges from quartiles
            cdi.lf = Math.min(
                cdi.q1,
                boxVals[Math.min(
                    Lib.findBin(2.5 * cdi.q1 - 1.5 * cdi.q3, boxVals, true) + 1,
                    bvLen - 1
                )]
            );
            cdi.uf = Math.max(
                cdi.q3,
                boxVals[Math.max(
                    Lib.findBin(2.5 * cdi.q3 - 1.5 * cdi.q1, boxVals),
                    0
                )]
            );

            // lower and upper outliers - 3 IQR out (don't clip to max/min,
            // this is only for discriminating suspected & far outliers)
            cdi.lo = 4 * cdi.q1 - 3 * cdi.q3;
            cdi.uo = 4 * cdi.q3 - 3 * cdi.q1;

            cd.push(cdi);
        }
    }

    Axes.expand(valAxis, val, {padded: true});

    if(cd.length > 0) {
        cd[0].t = {
            boxnum: gd.numboxes,
            dPos: dPos
        };
        gd.numboxes++;
        return cd;
    } else {
        return [{t: {emptybox: true}}];
    }
};

// In vertical (horizontal) box plots:
// if no x (y) data, use x0 (y0), or name
// so if you want one box
// per trace, set x0 (y0) to the x (y) value or category for this trace
// (or set x (y) to a constant array matching y (x))
function getPos(trace, posLetter, posAxis, val, numboxes) {
    if(posLetter in trace) {
        return posAxis.makeCalcdata(trace, posLetter);
    }

    var pos0;

    if(posLetter + '0' in trace) {
        pos0 = trace[posLetter + '0'];
    } else if('name' in trace && (
        posAxis.type === 'category' || (
            isNumeric(trace.name) &&
            ['linear', 'log'].indexOf(posAxis.type) !== -1
        ) || (
            Lib.isDateTime(trace.name) &&
            posAxis.type === 'date'
        )
    )) {
        pos0 = trace.name;
    } else {
        pos0 = numboxes;
    }

    var pos0c = posAxis.d2c(pos0, 0, trace[posLetter + 'calendar']);
    return val.map(function() { return pos0c; });
}

function makeBins(x, dx) {
    var len = x.length;
    var bins = new Array(len + 1);

    for(var i = 0; i < len; i++) {
        bins[i] = x[i] - dx;
    }
    bins[len] = x[len - 1] + dx;

    return bins;
}

function initNestedArray(len) {
    var arr = new Array(len);
    for(var i = 0; i < len; i++) {
        arr[i] = [];
    }
    return arr;
}

function arraysToCalcdata(pt, trace, i) {
    var trace2calc = {
        text: 'tx'
    };

    for(var k in trace2calc) {
        if(Array.isArray(trace[k])) {
            pt[trace2calc[k]] = trace[k][i];
        }
    }
}

function sortByVal(a, b) { return a.v - b.v; }

function extractVal(o) { return o.v; }
