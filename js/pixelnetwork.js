(function($, window) {
    var colorDistance = function(c1, c2) {
        return (Math.abs(c1[0] - c2[0]) + Math.abs(c1[1] - c2[1]) + Math.abs(c1[2] - c2[2]) + Math.abs(c1[3] - c2[3])) / 1024
    }

	var PixelNetwork = function(image_data, options) {

		options = $.extend({
			rows: 50,
			cols: 50
		},
		options);

        this.reset();

        this.image_data = image_data;

        this.rows = options.rows;
        this.cols = options.cols;

		this.width  = image_data.width;
		this.height = image_data.height;
		this.cell_width = this.width / this.cols;
		this.cell_height = this.height / this.rows;
        this.grid = new Grid(this.width, this.height, this.cols, this.rows);
        // register corners
        this.registerPoint({x:0, y:0, z:1});
        this.registerPoint({x:this.width-1, y:0, z:1});
        this.registerPoint({x:this.width-1, y:this.height-1, z:1});
        this.registerPoint({x:0, y:this.height-1, z:1});

	}

	PixelNetwork.prototype.reset = function() {
		this.points = {};
		this.num_points = 0;
        this.contrastVelocity = 0;
        this.stats = {
            color_distances: [],
            dz: []
        };

        // a hash of points belonging to a specific cell
        this.cell_points = {};
        // a hash of distances between each point pair
        this.distances_cache = {};
    }

	PixelNetwork.prototype.cellIndexToCoords = function(cellidx) {
        return this.grid.indexToCoords(cellidx);
	}

	PixelNetwork.prototype.movePoint = function(point, x, y, z) {
        point.x = isNaN(x) ? point.x : x;
        point.y = isNaN(y) ? point.y : y;
        point.z = isNaN(z) ? point.z : z;
        // this will remove the point from any previously registered cells
        this.registerPointToCell(point);
    }
	PixelNetwork.prototype.registerPointToCell = function(point, cellidx) {
        if (!point || !point.idx) {
            throw new Error('Invalid point');
        }
        if (!cellidx) {
            cellidx = this.getPointCell(point.x, point.y);
        }
		if (! (cellidx in this.cell_points)) {
			this.cell_points[cellidx] = {};
		}
		if (point.cell) {
            if (point.idx in this.cell_points[point.cell]) {
                delete this.cell_points[point.cell][point.idx];
            }
        }
		this.cell_points[cellidx][point.idx] = true;
        point.cell = cellidx;
    }
	PixelNetwork.prototype.getPointCell = function(x, y) {
        return this.grid.coordsToIndex(x,y);
	}
	PixelNetwork.prototype.getPointByIdx = function(idx) {
        return this.points[idx];
    }
	PixelNetwork.prototype.getClosestPointIdxTo = function(p, distance) {
		var distances = this.getNeighbourDistances(p, distance);
		if (distances.length) {
            return distances[0].point.idx;
        }
        return false;
    }
	PixelNetwork.prototype.getPointClosestTo = function(point, distance) {
        var pidx = this.getClosestPointIdxTo(point, distance);
        return this.getPointByIdx(pidx);
	}
	PixelNetwork.prototype.getCount = function() {
        return this.num_points;
    }
	PixelNetwork.prototype.registerPoint = function(point) {
        var last_point = this.points[this.num_points];
        if (last_point) {
            var dx = point.x - last_point.x;
            var dy = point.y - last_point.y;
            var dd = dx*dx + dy*dy;
            if (dd < 100) {
                // if this point is within 10 pixels of the last point ignore it
                return;
            }
        }
        if (!point.idx) {
            point.idx = ++this.num_points;
        }
        this.registerPointToCell(point);
		this.points[point.idx] = point;
        return point;

	}
	PixelNetwork.prototype.processSinglePixel = function(idx, options) {
		options = options || {};
		var w = this.width;
		var h = this.height;
		var minContrastDistance = options.contrastDistance || 0.01;
		var i = idx;
		var pdd = this.image_data.data;
		// coordinates of the current pixel
		var xi = i % w;
		var yi = (i / w) | 0;
        if (options.debug) console.log('info', i, idx, xi, yi, w, h);

		var pidx = (yi * w + xi) << 2;
		var a = [pdd[pidx + 0 + 0], pdd[pidx + 1 + 0], pdd[pidx + 2 + 0], pdd[pidx + 3 + 0]];
		// pixel above
		var pidxb = pidx - (w << 2);
		var b = [pdd[pidxb + 0], pdd[pidxb + 1], pdd[pidxb + 2], pdd[pidxb + 3]];
		var cd = colorDistance(a, b);
        if (pidxb > 0 && !this.checkContrastDistance(cd, minContrastDistance)) {
			return this.registerPoint({
				x: xi,
				y: yi,
				z: cd
			});
		}
        // pixel before
		b = [pdd[pidx + 0 + 4], pdd[pidx + 1 + 4], pdd[pidx + 2 + 4], pdd[pidx + 3 + 4]];
		cd = colorDistance(a, b);
        if (this.checkContrastDistance(cd, minContrastDistance)) {
            return;
        }

        // pixel after
		b = [pdd[pidx + 0 - 4], pdd[pidx + 1 - 4], pdd[pidx + 2 - 4], pdd[pidx + 3 - 4]];
		cd = colorDistance(a, b);
        if (!this.checkContrastDistance(cd, minContrastDistance)) {
			return this.registerPoint({
				x: xi,
				y: yi,
				z: cd
			});
		}

	}
	PixelNetwork.prototype.checkContrastDistance = function(contrastDistance, allowedDistance) {
        allowedDistance = allowedDistance || 0.001;
        if (!isNaN(contrastDistance)) {
            var dc = this.contrastVelocity - contrastDistance;
            this.contrastVelocity -= dc/3;
            if (Math.abs(dc) < allowedDistance) {
                return true;
            }
        }
        return false;
    }
	PixelNetwork.prototype.process = function(options) {
		options = options || {};
		var minContrastDistance = options.contrastDistance || 0.01;
		var w = this.width;
		var h = this.height;

		var i = w * h;
		var pdd = this.image_data.data;
		while (i--) {
            var xi = i % w;
            var yi = (i / w) | 0;

            var pidx = (yi * w + xi) << 2;
            var a = [pdd[pidx + 0 + 0], pdd[pidx + 1 + 0], pdd[pidx + 2 + 0], pdd[pidx + 3 + 0]];
            // pixel above
            var pidxb = pidx - (w << 2);
            var b = [pdd[pidxb + 0], pdd[pidxb + 1], pdd[pidxb + 2], pdd[pidxb + 3]];
            var cd = colorDistance(a, b);
            if (pidxb > 0 && !this.checkContrastDistance(cd, minContrastDistance)) {
                this.registerPoint({
                    x: xi,
                    y: yi,
                    z: cd
                });
                continue;
            }
            // pixel before
            b = [pdd[pidx + 0 + 4], pdd[pidx + 1 + 4], pdd[pidx + 2 + 4], pdd[pidx + 3 + 4]];
            cd = colorDistance(a, b);
            if (this.checkContrastDistance(cd, minContrastDistance)) {
                continue;
            }

            // pixel after
            b = [pdd[pidx + 0 - 4], pdd[pidx + 1 - 4], pdd[pidx + 2 - 4], pdd[pidx + 3 - 4]];
            cd = colorDistance(a, b);
            if (!this.checkContrastDistance(cd, minContrastDistance)) {
                this.registerPoint({
                    x: xi,
                    y: yi,
                    z: cd
                });
                continue;
            }
		}
	}
	PixelNetwork.prototype.render = function() {
		var p, pidx;
		var pdd = this.image_data.data;
		var w = this.width;
		var colors = [[255, 0, 0, 255], [255, 255, 0, 255], [0, 255, 0, 255], [0, 255, 255, 255], [0, 0, 255, 255], [255, 0, 255, 255]];
		for (var i in this.points) {
			p = this.points[i];
			//var c = colors[ this.getPointCell(p.x, p.y) % colors.length ];
			pidx = (p.x + p.y * w) * 4;
			pdd[pidx + 0] = 0; //c[0];
			pdd[pidx + 1] = 0; //c[1];
			pdd[pidx + 2] = 0; //c[2];
			pdd[pidx + 3] = 255;
		}
	}
	PixelNetwork.prototype.drawGrid = function() {
		var pdd = this.image_data.data;
		for (var i = 0; i < this.cols; i++) {
			for (var j = 0; j < this.rows; j++) {
				var idx = (i * this.cell_width + j * (this.cell_width * this.cols) * this.cell_height) << 2;
				pdd[idx + 0] = 255; // red dot
				pdd[idx + 1] = 0; // red dot
				pdd[idx + 2] = 0; // red dot
				pdd[idx + 4] = 255; // red dot
				pdd[idx + 3] = 0; // red dot
				pdd[idx + 2] = 0; // red dot
				pdd[idx - 4] = 255; // red dot
				pdd[idx - 3] = 0; // red dot
				pdd[idx - 2] = 0; // red dot
			}
		}
	}
	PixelNetwork.prototype.validateDistance = function(distance) {
        // min 5 max 10000
		return Math.max(Math.min(distance || 10, 100), 5);
	}
	PixelNetwork.prototype.getDistance = function(p, q) {
        var a = Math.min(p.idx, q.idx);
        var b = Math.max(p.idx, q.idx);
        var key = a+':'+b;
        if (!this.distances_cache[key]) {
            var dx = p.x - q.x;
            var dy = p.y - q.y;
            this.distances_cache[key] = Math.sqrt(dx * dx + dy * dy);
        }
        return this.distances_cache[key];
    }
	PixelNetwork.prototype.getNeighbourDistances = function(p, distance) {
		var cells = this.getNeighbourCells(p, distance);
		var distances = [];
		for (var j = 0; j < cells.length; j++) {
			var cell_points = this.cell_points[cells[j]];
			for (var qidx in cell_points) {
				var q = this.points[qidx];
                if (p.idx == q.idx) continue;

                var d = this.getDistance(p, q);
				distances.push({
					point: q,
					distance: d
				});
			}
		}
		distances.sort(function(a, b) {
			if (a.distance < b.distance) return -1;
			if (a.distance > b.distance) return 1;
			return 0;
		});

		return distances;
	}

	PixelNetwork.prototype.getNeighbourCells = function(p, distance) {
		distance = this.validateDistance(distance);
		return this.grid.getCellsInRadius(distance, p.x, p.y);
	}
	PixelNetwork.prototype.reducePoint = function(p, options, deleted) {
		if (!p || isNaN(p.idx)) return 0;
		deleted = deleted || {};
        options = options || {};
		var distance = this.validateDistance(options.pixelDistance || 10);
		var color_distance = options.contrastDistance || 0.01;
		if (!p.cell) {
			p.cell = this.getPointCell(p.x, p.y);
		}
		var distances = this.getNeighbourDistances(p, distance);
		var pdd = this.image_data.data;
        var w = this.image_data.width;
        var pidx = (p.y * w + p.x) << 2;
        var pcol = [pdd[pidx + 0 + 0], pdd[pidx + 1 + 0], pdd[pidx + 2 + 0], pdd[pidx + 3 + 0]];
        
        var count_deleted = 0;
        // loop through geom distances
		for (var i = 0; i < distances.length; i++) {
            var q = distances[i].point;
            var d = distances[i].distance;
            if (deleted[q.idx] || q.idx == p.idx) continue;
            // find points that are close
            if (d < distance) {
                // Now do a color distance
                var qidx = (q.y * w + q.x) << 2;
                var qcol = [pdd[qidx + 0 + 0], pdd[qidx + 1 + 0], pdd[qidx + 2 + 0], pdd[qidx + 3 + 0]];
                var dcol = colorDistance(pcol, qcol);
                this.stats.color_distances.push(dcol);
                
                // colorDistance
                // distance of 0 means exactly the same color;
                // distance of 1 means completely different including the alpha
                // distance of 0.75 means 3 out of 4 (r,g,b,a) channels are completely different
                
                // but this is distance of color distances
                // the maximum difference between the color distances that allows merging two colours

                if ((d < 5) /* all vertices less than 5px apart */
                    || (dcol < color_distance)) {
                    var dz = p.z - q.z;
                    this.stats.dz.push(dz);
                    var a,b;
                    if (dz >= 0) {
                        a = p;
                        b = q;
                    }
                    else {
                        a = q;
                        b = p;
                    }
                    a.x = (a.x + b.x) >> 1;
                    a.y = (a.y + b.y) >> 1;
                    a.z = a.z + dz*dz;
                    if (a==q) this.movePoint(a);
                    this.deletePoint(b);
                    deleted[b.idx] = true;
                    count_deleted++;
                }
            }
            if (deleted[p.idx]) break;
        }
        if (! deleted[p.idx]) this.movePoint(p);
        return count_deleted;
	}
	PixelNetwork.prototype.reduce = function(options) {
		var deleted = {};
		var count = 0;
		for (var i in this.points) {
			var p = this.points[i];
			if (deleted[p.idx]) continue;
			count += this.reducePoint(p, options, deleted);
		}
        return count;
	}
	PixelNetwork.prototype.setPoints = function(points) {
		this.points = points;
	}
	PixelNetwork.prototype.getPoints = function() {
        return this.points;
	}
	PixelNetwork.prototype.deletePoint = function(point) {
		delete this.points[point.idx]
		for (var i in this.cell_points) {
			delete this.cell_points[i][point.idx];
		}
	};
	window.PixelNetwork = PixelNetwork;
})(jQuery, window);

