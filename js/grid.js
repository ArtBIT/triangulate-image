(function(window) {

	function Grid(width, height, cols, rows) {
		this.width = width;
		this.height = height;
		this.cols = cols;
		this.rows = rows;
		this.reset('#fff');
	}
	Grid.prototype.reset = function(color) {
		color = color || '#fff';
		this.cell_width = this.width / this.cols;
		this.cell_height = this.height / this.rows;
		this.cells = [];
		var i = this.rows * this.cols;
		while (i--) {
			this.cells.push(color);
		}
	};
	Grid.prototype.render = function(ctx) {
		ctx.save();
		var i = this.rows * this.cols;
		while (i--) {
			var x = (i % this.cols) * this.cell_width;
			var y = (Math.floor(i / this.cols)) * this.cell_height;
			ctx.fillStyle = this.cells[i];
			ctx.fillRect(x, y, this.cell_width, this.cell_height);
		}
		ctx.restore();
	};
	Grid.prototype.indexToCoords = function(idx) {
		var x = (idx % this.cols) * this.cell_width;
		var y = ((idx / this.rows) | 0) * this.cell_height;
		return {
			x: x,
			y: y
		};
	}
	Grid.prototype.coordsToIndex = function(x, y) {
		var cx = (x / this.cell_width) | 0;
		var cy = (y / this.cell_height) | 0;
		return this.cols * cy + cx;
	}
	Grid.prototype.getCellAt = function(x, y) {
		return this.cells[this.coordsToIndex(x, y)];
	}
	Grid.prototype.getCellsInRadius = function(radius, xcenter, ycenter) {
		var cells = [];
		var rr = radius * radius;

		var mincx = ((xcenter - radius) / this.cell_width) | 0;
		var mincy = ((ycenter - radius) / this.cell_height) | 0;
		var maxcx = ((xcenter + radius) / this.cell_width) | 0;
		var maxcy = ((ycenter + radius) / this.cell_height) | 0;

		var i = this.rows * this.cols;
		while (i--) {
			var cx = (i % this.cols);
			var cy = (i / this.cols) | 0;
			if (cx < mincx || cy < mincy || cx > maxcx || cy > maxcy) {
				continue;
			}
			// calculate cell's center
			var cellcenter = {
				x: (cx + 0.5) * this.cell_width,
				y: (cy + 0.5) * this.cell_height
			};
			// check if it's inside the circle
			var dx = cellcenter.x - xcenter;
			var dy = cellcenter.y - ycenter;
			if ((dx * dx + dy * dy) < rr) {
				cells.push(i);
			}
		}
		return cells;
	};
	window.Grid = Grid;

})(window);

