/**
* Copyright 2012-2017, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/

'use strict';

var DESELECTDIM = require('../../constants/interactions').DESELECTDIM;

module.exports = function selectPoints(searchInfo, polygon) {
    var cd = searchInfo.cd;
    var xa = searchInfo.xaxis;
    var ya = searchInfo.yaxis;
    var trace = cd[0].trace;
    var node3 = cd[0].node3;
    var selection = [];

    var i, j, pts;

    if(trace.visible !== true) return [];

    if(polygon === false) {
        // clear selection
        for(j = 0; j < cd.length; j++) {
            pts = cd[j].pts;
            for(i = 0; i < pts.length; i++) {
                pts[i].dim = 0;
            }
        }
    } else {
        for(j = 0; j < cd.length; j++) {
            pts = cd[j].pts;
            for(i = 0; i < pts.length; i++) {
                var di = pts[i];
                var x = xa.c2p(di.x);
                var y = ya.c2p(di.y);

                if(polygon.contains([x, y])) {
                    selection.push({
                        pointNumber: di.i,
                        x: di.x,
                        y: di.y
                    });
                    di.dim = 0;
                } else {
                    di.dim = 1;
                }
            }
        }
    }

    node3.selectAll('.point').style('opacity', function(d) {
        return d.dim ? DESELECTDIM : 1;
    });

    return selection;
};
