Image Triangulation
===================
![Super Mario Sky](http://github.com/ArtBIT/triangulate-image/raw/master/images/example.png)

Simple Web App that tries to turn an image into a triangulated mosaic. Check [this link](http://artbit.deviantart.com/gallery/38261066) for example results.

# Demo
[Click Here](http://artbit.github.io/triangulate-image/index.html) to see a live demo.

# Example Usage

    <script type='text/javascript'>
        // let's say the `img` variable holds a reference to an image element with the uploaded image
            var w = img.width;
            var h = img.height;

        // create canvas element
            var canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;

        // draw the image onto the canvas
            var ctx = this.canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);

        // get the pixel data
            image_data = ctx.getImageData(0, 0, w, h);

        // process the pixels
            var pixelNetwork = new PixelNetwork(image_data);
            pixelNetwork.process();
            pixelNetwork.reduce();

        // get the resulting points
            var points = pixelNetwork.getPoints();

        // triangulate points
            var triangles = Triangulate(points);

        // draw the triangles
            for (var i in triangles) {
                var triangle = triangles[i];

                ctx.beginPath();

                ctx.moveTo(triangle.v0.x, triangle.v0.y);
                ctx.lineTo(triangle.v1.x, triangle.v1.y);
                ctx.lineTo(triangle.v2.x, triangle.v2.y);

                ctx.closePath();

                var triangle_center = {
                    x: ((triangle.v0.x + triangle.v1.x + triangle.v2.x) / 3) | 0,
                    y: ((triangle.v0.y + triangle.v1.y + triangle.v2.y) / 3) | 0
                };

                // find out the color of the pixel at the center of the triangle, see the source for helper functions used
                var rgba = arrayToRgba(getPixel(this.original_image_data, triangle_center.x, triangle_center.y));
                this.ctx.strokeStyle = rgba;
                this.ctx.fillStyle = rgba;
                this.ctx.fill();
                this.ctx.stroke();

            }
    </script>

See the [index.html](http://github.com/ArtBIT/triangulate-image/blob/master/index.html) file for an example app.
